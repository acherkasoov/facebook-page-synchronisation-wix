/*
 * FB Page Sync for Wix (Velo) — core sync logic.
 *
 * Fetches posts from a Facebook Page via the Graph API and stores new ones in
 * the "FacebookPosts" CMS collection. Called by the scheduled job (jobs.config)
 * and by the manual trigger (sync.jsw).
 *
 * Place this file in the Velo  Backend  section.
 */

import { fetch } from 'wix-fetch';
import wixData from 'wix-data';
import { getSecret } from 'wix-secrets-backend';
import { mediaManager } from 'wix-media-backend';

const API_VERSION = 'v19.0';
const COLLECTION = 'FacebookPosts';
const FETCH_LIMIT = 25;          // most recent posts examined per run (1–100)
const MEDIA_FOLDER = '/FacebookPosts';

/**
 * Entry point. Returns a summary object; never throws (so the job stays green).
 */
export async function syncFacebookPosts() {
	try {
		const pageId = await getSecret('fbPageId');
		const token = await getSecret('fbPageToken');

		if (!pageId || !token) {
			console.error('FB Page Sync: missing fbPageId / fbPageToken secrets.');
			return { created: 0, error: 'Missing secrets' };
		}

		const posts = await fetchPublishedPosts(pageId, token);
		if (posts.error) {
			console.error('FB Page Sync: ' + posts.error);
			return { created: 0, error: posts.error };
		}

		let created = 0;
		for (const post of posts.data) {
			// eslint-disable-next-line no-await-in-loop
			if (await importPost(post)) {
				created++;
			}
		}

		console.log(`FB Page Sync: fetched ${posts.data.length}, imported ${created} new.`);
		return { fetched: posts.data.length, created };
	} catch (err) {
		console.error('FB Page Sync: unexpected error', err);
		return { created: 0, error: String(err) };
	}
}

/**
 * Call the Graph API and return { data: [...] } or { error: "..." }.
 */
async function fetchPublishedPosts(pageId, token) {
	const fields = 'id,message,story,created_time,permalink_url,full_picture';
	const url =
		`https://graph.facebook.com/${API_VERSION}/${encodeURIComponent(pageId)}/published_posts` +
		`?fields=${encodeURIComponent(fields)}` +
		`&limit=${FETCH_LIMIT}` +
		`&access_token=${encodeURIComponent(token)}`;

	const res = await fetch(url, { method: 'get' });
	const body = await res.json();

	if (!res.ok) {
		const msg = body && body.error ? body.error.message : `HTTP ${res.status}`;
		return { error: msg };
	}
	return { data: Array.isArray(body.data) ? body.data : [] };
}

/**
 * Insert one Facebook post into the collection if it isn't already there.
 * @returns {Promise<boolean>} true if a new item was created.
 */
async function importPost(post) {
	if (!post || !post.id) {
		return false;
	}

	// De-dupe: skip if this Facebook post was already imported.
	const existing = await wixData
		.query(COLLECTION)
		.eq('fbPostId', post.id)
		.limit(1)
		.find({ suppressAuth: true });
	if (existing.items.length > 0) {
		return false;
	}

	const message = (post.message || post.story || '').trim();
	const imageExternal = post.full_picture || '';

	// Nothing worth importing.
	if (!message && !imageExternal) {
		return false;
	}

	const title = makeTitle(message, post);

	// Try to import the image into Wix Media so it can be bound in the Editor.
	let wixImage = '';
	if (imageExternal) {
		wixImage = await importImage(imageExternal);
	}

	const item = {
		title,
		content: message,
		fbPostId: post.id,
		permalink: post.permalink_url || '',
		imageUrl: imageExternal,        // external fallback (always set)
		publishedDate: post.created_time ? new Date(post.created_time) : new Date()
	};
	if (wixImage) {
		item.image = wixImage;          // Wix media URL (wix:image://...)
	}

	await wixData.insert(COLLECTION, item, { suppressAuth: true });
	return true;
}

/**
 * Derive a title from the first line of the message, or fall back to the date.
 */
function makeTitle(message, post) {
	if (message) {
		const firstLine = message.split('\n')[0].trim();
		const words = firstLine.split(/\s+/);
		if (words.length > 12) {
			return words.slice(0, 12).join(' ') + '…';
		}
		if (firstLine) {
			return firstLine;
		}
	}
	const d = post.created_time ? new Date(post.created_time) : new Date();
	return 'Facebook post – ' + d.toLocaleDateString();
}

/**
 * Import an external image URL into the Wix Media Manager.
 * @returns {Promise<string>} a wix:image:// URL, or '' on failure.
 */
async function importImage(externalUrl) {
	try {
		const info = await mediaManager.importFile(MEDIA_FOLDER, externalUrl, {
			mediaOptions: { mimeType: 'image/jpeg', mediaType: 'image' },
			metadataOptions: { isPrivate: false, isVisitorUpload: false }
		});
		return info && info.fileUrl ? info.fileUrl : '';
	} catch (err) {
		console.warn('FB Page Sync: image import failed, using external URL.', err);
		return '';
	}
}

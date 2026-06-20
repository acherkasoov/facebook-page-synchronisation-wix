/*
 * FB Page Sync for Wix (Velo) — example page code.
 *
 * Displays imported Facebook posts in a Repeater. Paste this into the code panel
 * of the page that holds your Repeater, and adjust the element IDs to match your
 * design.
 *
 * Required elements (rename the IDs below to match yours):
 *   #postsRepeater   — a Repeater
 *   inside each item:
 *     #postImage     — an Image
 *     #titleText     — a Text element
 *     #contentText   — a Text element
 *     #originalLink  — a Button or Text (link to the original Facebook post)
 *
 * Optional (admin testing): a Button #syncNowButton anywhere on the page.
 */

import wixData from 'wix-data';
import { runSyncNow } from 'backend/sync.jsw';

$w.onReady(async () => {
	await loadPosts();

	// Optional manual "Sync now" button — remove if you don't add one.
	if ($w('#syncNowButton')) {
		$w('#syncNowButton').onClick(async () => {
			$w('#syncNowButton').disable();
			const result = await runSyncNow();
			console.log('Sync result:', result);
			await loadPosts();
			$w('#syncNowButton').enable();
		});
	}
});

async function loadPosts() {
	const results = await wixData
		.query('FacebookPosts')
		.descending('publishedDate')
		.limit(50)
		.find();

	$w('#postsRepeater').onItemReady(($item, itemData) => {
		$item('#titleText').text = itemData.title || '';
		$item('#contentText').text = itemData.content || '';

		const imgSrc = itemData.image || itemData.imageUrl;
		if (imgSrc) {
			$item('#postImage').src = imgSrc; // works for both Wix media and external URLs
			$item('#postImage').show();
		} else {
			$item('#postImage').hide();
		}

		if (itemData.permalink) {
			$item('#originalLink').link = itemData.permalink;
			$item('#originalLink').target = '_blank';
			$item('#originalLink').show();
		} else {
			$item('#originalLink').hide();
		}
	});

	$w('#postsRepeater').data = results.items;
}

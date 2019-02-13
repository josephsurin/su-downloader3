import { getRemoteFilesize, getMetadata, makeRequests, getThreadPositions } from './core'

function startDownload(url, savePath, options = { threads: 4, headers: null }) {

	var filesize$ = getRemoteFilesize(url)

	var meta$ = getMetadata(url, savePath, options.threads, filesize$)

	var requestsAndMeta$ = makeRequests(meta$, options.headers)

	var threadPositions$ = getThreadPositions(requestsAndMeta$)

	//the first value emitted is the meta data object
	return threadPositions$
}

module.exports = {
	startDownload
}
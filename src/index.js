import { getRemoteFilesize, getMetadata, makeRequests, getThreadPositions, getDownloadProgressInfo } from './core'

function startDownload(url, savePath, { threads = 4, timeout = 3*60*1000, headers = null, throttleRate = 500 } = {}) {

	var filesize$ = getRemoteFilesize(url)

	var meta$ = getMetadata(url, savePath, threads, filesize$)

	var requestsAndMeta$ = makeRequests(meta$, { timeout, headers })

	var threadPositions$ = getThreadPositions(requestsAndMeta$)

	var downloadProgressInfo$ = getDownloadProgressInfo(threadPositions$, throttleRate)

	//the first value emitted is the meta data object
	return downloadProgressInfo$
}

module.exports = {
	startDownload
}
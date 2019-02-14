import { getRemoteFilesize, getMetadata, makeRequests, getThreadPositions, getDownloadProgressInfo, readMetadata } from './core'

function startDownload(locations, { threads = 4, timeout = 3*60*1000, headers = null, throttleRate = 500 } = {}) {

	var filesize$, meta$

	//resuming download
	if(typeof locations == 'string') {
		meta$ = readMetadata(locations)
	} else { //starting new download
		var { url, savePath } = locations

		filesize$ = getRemoteFilesize(url)
		meta$ = getMetadata(url, savePath, threads, filesize$)
	}

	var requestsAndMeta$ = makeRequests(meta$, { timeout, headers })

	var threadPositions$ = getThreadPositions(requestsAndMeta$)

	var downloadProgressInfo$ = getDownloadProgressInfo(threadPositions$, throttleRate)

	//the first value emitted is the meta data object
	return downloadProgressInfo$
}

module.exports = {
	startDownload
}
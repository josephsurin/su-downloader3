import { getMetadata, makeRequests, getThreadPositions, getDownloadProgressInfo, readMetadata } from './core'
import { killFiles, sudPath, isSudPath } from './util'

function startDownload(locations, { threads = 4, timeout = 3*60*1000, headers = null, throttleRate = 500 } = {}) {

	var meta$

	if(typeof locations == 'string' && isSudPath(locations)) {

		//resuming download
		meta$ = readMetadata(locations)

	} else if(typeof locations == 'string') {

		//starting new download without save path
		meta$ = getMetadata(locations, null, threads)

	} else {

		//starting new download with save path
		var { url, savePath } = locations
		meta$ = getMetadata(url, savePath, threads)

	}

	var requestsAndMeta$ = makeRequests(meta$, { timeout, headers })

	var threadPositions$ = getThreadPositions(requestsAndMeta$)

	var downloadProgressInfo$ = getDownloadProgressInfo(threadPositions$, throttleRate)

	//the first value emitted is the meta data object
	return downloadProgressInfo$
}

module.exports = {
	startDownload,
	killFiles,
	sudPath
}
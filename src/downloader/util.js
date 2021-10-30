const fs = require('graceful-fs')
const request = require('request')
import { Observable, range, bindNodeCallback, of, throwError } from 'rxjs'
import { map, concatMap, ignoreElements, concat } from 'rxjs/operators'

export const sudPath = filename => filename + '.sud'
export const partialPath = (filename, index) => `${filename}.${index}.PARTIAL` 
export const isSudPath = filename => /.sud$/.test(filename)

export function createRequest(url, requestOptions) {
	return Observable.create(observer => {
		const req = request(url, requestOptions)
			.on('data', data => observer.next(data))
			.on('error', error => observer.error(error))
			.on('complete', () => observer.complete())

		//clean up function called when unsubscribed
		return () => req.abort()
	})
}

export const getLocalFilesize = filename => fs.existsSync(filename) ? fs.statSync(filename).size : 0

//takes a file size and the number of partial files (threads) to be used
//and calculates the ranges in bytes for each thread
export function calculateRanges(filesize, threads) {
	var ranges = new Array(threads)

	if(threads == 1) {
		ranges = [[0, filesize]]
	} else {
		var partitionSize = Math.floor(filesize / threads)
		ranges[0] = [0, partitionSize]
		for(var i = 1; i < threads - 1; i++) {
			ranges[i] = [(partitionSize * i) + 1, partitionSize * (i + 1)]
		}
		ranges[threads - 1] = [ranges[threads - 2][1] + 1, filesize]
	}

	return ranges
}

//position in this context starts counting at 0, i.e. the size of the .PARTIAL file
export function toRangeHeader(range, position) {
	var start = range[0] + position
	var end = range[1]
	return `bytes=${start}-${end}`
}

export function getRangeHeaders(savePath, ranges) {
	return ranges.map((range, index) => {
		var position = getLocalFilesize(partialPath(savePath, index))
		return range[0] + position >= range[1] ? 0 : toRangeHeader(range, position)
	})
}


export const fsReadFile = bindNodeCallback(fs.readFile)
const fsAppendFile = bindNodeCallback(fs.appendFile)
const fsUnlink = bindNodeCallback(fs.unlink)
const fsRename = bindNodeCallback(fs.rename)

//concatenates all .PARTIAL files and renames the resulting file
//cleans up by deleting .PARTIAL files and .sud meta data file
export function rebuildFiles(meta) {
	var { savePath, ranges } = meta

	var sudFile = sudPath(savePath)

	//check if the files actually need to be rebuilded
	//if each partial file is complete, the file size in bytes add the range lower bound should
	//differ from the range upper bound by no more than 1 byte (this only occurs for the first partial file
	//as it starts at 0)
	var notCompleted = ranges.some((range, index) => Math.abs(range[0] + getLocalFilesize(partialPath(savePath, index)) - range[1]) > 1)
	if(notCompleted) throwError('REBUILD ERROR: INCORRECT PARTIAL FILE SIZEZ')

	//if an entity at the save path already exists, delete it
	//the user should be responsbile for ensuring this does not happen if they do not want it to
	if(fs.existsSync(savePath)) fs.unlinkSync(savePath)

	return range(0, ranges.length).pipe(
		map(index => partialPath(savePath, index)),
		//transform each partial file name into an observable that when subscribed to appends data to
		//the save file and deletes it
		//concatMap ensures this is done in order
		concatMap(partialFile => 
			ranges.length > 1 ?
				of(partialFile).pipe(
					concatMap(partialFile => fsReadFile(partialFile)),
					concatMap(partialData => fsAppendFile(savePath, partialData)),
					concatMap(() => fsUnlink(partialFile))
				) :
				of(partialFile).pipe(
					concatMap(partialData => fsRename(partialData, savePath))
				)
		),
		concat(fsUnlink(sudFile)),
		//we don't care about the output, we just wanted to perform the actions
		//and put them in observables so the observable chain isn't interrupted
		ignoreElements()
	)

}

export const getInitialDownloadProgressInfo = meta => {
	return {
		time: {
			start: Date.now(), //timestamp
			elapsed: 0, //milliseconds
			eta: 0 //seconds
		},
		//bytes
		total: {
			filesize: meta.filesize,
			downloaded: 0,
			percentage: 0
		},
		instance: {
			downloaded: 0,
			percentage: 0
		},
		//bytes per second
		speed: 0,
		avgSpeed: 0,
		//[bytes]
		threadPositions: meta.ranges.map((range, index) => range[0] + getLocalFilesize(partialPath(meta.savePath, index)))
	}
}

//calculates the index of a thread based on its position
function getThreadIndexFromPosition(ranges, threadPosition) {
	return ranges.findIndex(range => threadPosition > range[0] && threadPosition <= range[1] + 1)
}

function initialiseDownloaded(ranges, threadPositions) {
	return threadPositions.reduce((downloaded, threadPosition, index) => {
		return downloaded + threadPosition - ranges[index][0]
	}, 0)
}

export function calculateDownloadProgressInfo(prev, threadPosition) {
	//return object of the same form as initialDownloadProgressInfo
	//check if the initialDownloadProgressInfo object exists, if it does, use that
	//instead of the 'previous' downloadProgressInfo object
	var { meta, initialDownloadProgressInfo, downloadProgressInfo } = prev
	var prevDownloadProgressInfo = initialDownloadProgressInfo || downloadProgressInfo

	var { time: { start, elapsed },  total: { filesize, downloaded }, instance, threadPositions } = prevDownloadProgressInfo
	var { ranges } = meta

	//initialise downloaded if necessary
	downloaded = initialDownloadProgressInfo ? initialiseDownloaded(ranges, threadPositions) : downloaded

	var currentTimestamp = Date.now()
	var deltaTime = currentTimestamp - start - elapsed
	var newElapsed = elapsed + deltaTime

	var threadIndex = getThreadIndexFromPosition(ranges, threadPosition)

	var deltaDownloaded = threadPosition - threadPositions[threadIndex]
	var newDownloaded = downloaded + deltaDownloaded
	var newInstanceDownloaded = instance.downloaded + deltaDownloaded
	var newPercentage = 100 * newDownloaded / filesize
	var newInstancePercentage = 100 * newInstanceDownloaded / filesize

	var newSpeed = 1000 * (deltaDownloaded / deltaTime)

	threadPositions[threadIndex] = threadPosition

	var avgSpeed = 1000 * newInstanceDownloaded / newElapsed
	var newEta = (filesize - newDownloaded) / avgSpeed

	var newDownloadProgressInfo = {
		time: {
			start,
			elapsed: newElapsed,
			eta: newEta
		},
		total: {
			filesize,
			downloaded: newDownloaded,
			percentage: newPercentage
		},
		instance: {
			downloaded: newInstanceDownloaded,
			percentage: newInstancePercentage
		},
		speed: newSpeed,
		avgSpeed,
		threadPositions
	}

	return newDownloadProgressInfo
}

export function killFiles(sudPath) {
	if(!fs.existsSync(sudPath)) return false
	var meta = JSON.parse(fs.readFileSync(sudPath))
	var { savePath, ranges } = meta
	for(var index = 0; index < ranges.length; index++) {
		fs.unlinkSync(partialPath(savePath, index))
	}
	fs.unlinkSync(sudPath)
	return true
}
#!/usr/bin/env node

var program = require('commander')

const path = require('path')
const fs = require('graceful-fs')
const { startDownload } = require('../build/downloader')
const observer = require('./observer')()

program
	.version('1.0.0')

program
	.command('start <url>')
	.description('start a new download, only one of -S, -s and -d should be specified')
	.option('-S, --saveas [save_name]', 'filename to save the file as in the current working directory')
	.option('-s, --savepath [save_path]', 'full path to save file to')
	.option('-d, --savedir [save_dir]', 'directory to save file to (generated filename)')
	.option('-t, --threads [threads]', 'number of threads to use')
	.option('-T, --timeout [timeout]', 'how long to maintain connection before aborting (ms)')
	.option('-H, --headers [headers]', 'HTTP request headers')
	.option('-r, --throttleRate [throttleRate]', 'throttle time between progress info')
	.action((url, options) => {
		if(!url) {
			console.error('a url is required, type sud3 start --help for help')
			process.exit(1)
		}
		var saveAs = null
		var savePath = null
		var saveDir = null
		if(options) {
			if(options.saveas) savePath = path.join(process.cwd(), options.saveas)
			if(options.savepath) savePath = options.savepath
			if(options.savedir) saveDir = options.savedir
			if(options.threads) options.threads = parseInt(options.threads)
			if(options.timeout) options.timeout = parseInt(options.timeout)
			if(options.headers) options.headers = JSON.parse(options.headers)
			if(options.throttleRate) options.throttleRate = parseInt(options.throttleRate)
		}
		startDownload({ url, savePath, saveDir }, options).subscribe(observer)
	})

program
	.command('resume <sud_path>')
	.description('resume a download from an existing .sud file')
	.option('-T, --timeout [timeout]', 'how long to maintain connection before aborting (ms)')
	.option('-H, --headers [headers]', 'HTTP request headers')
	.option('-r, --throttleRate [throttleRate]', 'throttle time between progress info')
	.action((sud_path, options) => {
		if(!sud_path) {
			console.error('a sud path is required, type sud3 resume --help for help')
			process.exit(1)
		}
		if(!fs.existsSync(sud_path)) {
			console.error('the provided sud path is invalid, type sud3 resume --help for help')
			process.exit(1)
		}
		if(options.timeout) options.timeout = parseInt(options.timeout)
		if(options.headers) options.headers = JSON.parse(options.headers)
		if(options.throttleRate) options.throttleRate = parseInt(options.throttleRate)
		startDownload(sud_path, options).subscribe(observer)
	})


program.parse(process.argv)
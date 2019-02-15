#!/usr/bin/env node

var program = require('commander')

const fs = require('graceful-fs')
const { startDownload } = require('../build/downloader')
const observer = require('./observer')()

program
	.version('1.0.0')

program
	.command('start [url] [save_path]')
	.description('start a new download')
	.option('-t, --threads [threads]', 'number of threads to use')
	.option('-T, --timeout [timeout]', 'how long to maintain connection before aborting (ms)')
	.option('-H, --headers [headers]', 'HTTP request headers')
	.option('-r, --throttleRate [throttleRate]', 'throttle time between progress info')
	.action((url, save_path, options) => {
		if(!url) {
			console.error('a url is required, please type sud3 --help for help')
			process.exit(1)
		}
		if(!save_path) {
			console.error('a save path is required, please type sud3 --help for help')
			process.exit(1)
		}
		if(options.threads) options.threads = parseInt(options.threads)
		if(options.timeout) options.timeout = parseInt(options.timeout)
		if(options.headers) options.headers = JSON.parse(options.headers)
		if(options.throttleRate) options.throttleRate = parseInt(options.throttleRate)
		startDownload({ url, savePath: save_path }, options).subscribe(observer)
	})

program
	.command('resume [sud_path]')
	.description('resume a download from an existing .sud file')
	.option('-T, --timeout [timeout]', 'how long to maintain connection before aborting (ms)')
	.option('-H, --headers [headers]', 'HTTP request headers')
	.option('-r, --throttleRate [throttleRate]', 'throttle time between progress info')
	.action((sud_path, options) => {
		if(!sud_path) {
			console.error('a sud path is required, please type sud3 --help for help')
			process.exit(1)
		}
		if(!fs.existsSync(sud_path)) {
			console.error('the provided sud path is invalid, please type sud3 --help for help')
			process.exit(1)
		}
		if(options.timeout) options.timeout = parseInt(options.timeout)
		if(options.headers) options.headers = JSON.parse(options.headers)
		if(options.throttleRate) options.throttleRate = parseInt(options.throttleRate)
		startDownload(sud_path, options).subscribe(observer)
	})


program.parse(process.argv)
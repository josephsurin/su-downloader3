const path = require('path')
const bytes = require('bytes')
require('draftlog').into(console).addLineListener(process.stdin)

const observer = () => {
	var sp = ''
	var draft = null
	return {
		next: x => {
			if(x.savePath) {
				sp = x.savePath
				draft = console.draft(`DOWNLOAD PATH: ${path.basename(sp)}   |   HTTP FILE: ${x.url}`)
			} else {
				draft(`${path.basename(sp)}  |  Downloaded: ${bytes(x.total.downloaded)}/${bytes(x.total.filesize)}   |   Speed: ${bytes(x.speed)}/s   |   Avg Speed: ${bytes(x.avgSpeed)}/s   |   Elapsed: ${x.time.elapsed / 1000}s   |   ETA: ${x.time.eta.toFixed(2)}s \n ${percentageToBar(x.total.percentage)}   ${x.total.percentage.toFixed(2)}%`)
			}
		},
		error: console.log,
		complete: () => {
			draft('FINISHED DOWNLOADING FILE SAVED TO \n', sp)
			process.exit(0)
		}
	}
}

module.exports = observer

const percentageToBar = percentage => {
	var fullLength = 50
	var progressLength = Math.floor(fullLength * percentage / 100)
	var bar = Array(fullLength).fill(' ')
	bar = bar.fill('▬', 0, progressLength)
	return bar
}
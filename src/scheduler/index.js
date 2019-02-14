import { startDownload, sudPath } from '../downloader/'

const SuDScheduler = class {

	//holds all download tasks as objects with status and params fields
	#taskQueue = []
	//holds objects that have a key and a subscription field
	//the subscription field holds the flowing download subscription
	#downloadSubscriptions = {}

	options = {}

	constructor({ autoStart = false, maxConcurrentDownloads = 4, downloadOptions = {} } = {}) {
		this.options.autoStart = autoStart
		this.options.maxConcurrentDownloads = maxConcurrentDownloads
		this.options.downloadOptions = downloadOptions
	}

	//PUBLIC METHODS

	//adds a download task to the queue
	//if autoStart option is enabled, observer MUST be provided
	//this method is used to add new downloads or resume from pre existing .sud files
	//if the intention is to queue a download from a pre existing .sud file, locations should be
	//the .sud file path and options.threads will be unnecessary
	queueDownload(locations, options, observer) {
		var taskQueueItem = {
			key: typeof locations == 'string' ? locations : sudPath(locations.savePath),
			status: 'queued',
			params: { locations, options }
		}
		this.#taskQueue.push(taskQueueItem)

		if(this.options.autoStart && this.#canStartNew) {
			this.#startNextInQueue(observer)
		}
	}

	//starts a download task, or resumes an active download
	startDownload(key, observer) {

		var taskQueueItem = this.#getTaskQueueItem(key)
		var { params: { locations, options } } = taskQueueItem
		var dlOptions = Object.assign(this.options.downloadOptions, options)

		taskQueueItem.status = 'active'

		var dlSubscription = startDownload(locations, dlOptions).subscribe(observer)
		this.#downloadSubscriptions[key] = dlSubscription
	}

	//stops an active download
	stopDownload(key) {

	}

	//stops an active download and removes associated .sud and .PARTIAL files, or
	//removes download task from queue 
	killDownload(key) {

	}

	//starts downloading as many as possible, limited by the maxConcurrentDownloads option
	startQueue() {

	}

	//stops all active (including forced) downloads
	stopQueue() {

	}

	//PRIVATE METHODS
	#countStatus(status) {
		return this.#taskQueue.filter(taskQueueItem => taskQueueItem.status == status).length
	}

	#countTasks() {
		return this.#taskQueue.length
	}

	//checks if the conditions for starting a new task are met
	#canStartNew() {
		return this.#countStatus('active') < this.options.maxConcurrentDownloads
	}

	//starts the next task in queue
	#startNextInQueue(observer) {
		var key = this.#taskQueue.find(taskQueueItem => taskQueueItem.status == 'queued').key
		this.startDownload(key, observer)
	}

	#getTaskQueueItem(key) {
		return this.#taskQueue.find(taskQueueItem => taskQueueItem.key == key)
	}
	
}

module.exports = SuDScheduler
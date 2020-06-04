const querystring = require('querystring')
const axios = require("axios")


const MONITOR_API_URL = "https://cronitor.io/v3/monitors"
const PING_API_URL = "https://cronitor.link"

function Monitor(options={}) {
  if(!options.apiKey) throw new Error("You must provide an apiKey.")
  this.apiKey = options.apiKey || null
  axios.defaults.headers.common['Authorization'] = 'Basic ' + new Buffer(this.apiKey + ':').toString('base64')
}

/****
* Create new monitor
*
* @params { Object } obj monitor information
* @returns {Promise} Promise (err, body)
*
*/
Monitor.prototype.create = withApiValidation(function(obj) {
  return axios
    .post(MONITOR_API_URL, obj)
    .then((res) => {
      this.monitorId = res.data.code
      return res.data
    })
    .catch((err) => {
      return err.response
    })
})

/****
* Create a new cron job monitor
*
* @params { Object } config object.
*   required keys: expression, name
*   optional keys: notificationLists, graceSeconds
* @returns {Promise} Promise (err, body)
*
*/
Monitor.prototype.createCron = withApiValidation(function(config = {}) {
  if (!config.expression)
    throw new Error("'expression' is a required field e.g. {expression: '0 0 * * *', name: 'Daily at 00:00}")
  if (!config.name || !config.name.length)
    throw new Error("'name' is a required field e.g. {expression: '0 0 * * *', name: 'Daily at 00:00'}")
  if (config.notificationLists && !Array.isArray(config.notificationLists))
    throw new Error("'notificationLists' must be an array e.g. ['site-emergency']")

  let params = {
    type: "cron",
    name: config.name,
    rules: [
        {
          rule_type: "not_on_schedule",
          value: config.expression,
          grace_seconds: config.graceSeconds || null
        }
    ],
  }

  if (config.notificationLists)
    params['notifications'] = {templates: config.notificationLists}

  return this.create(params)
})

/****
* Create a new heartbeat monitor
*
* @params { Object } config object.
*   required keys: every, name
*   optional keys: notificationLists, graceSeconds
* @returns {Promise} Promise (err, body)
*
*/
Monitor.prototype.createHeartbeat = withApiValidation(function(config = {}) {
  let timeUnits = ['seconds', 'minutes', 'hours', 'days', 'weeks']

  if (!config.every && !config.at)
    throw new Error("missing required field 'every' or 'at'")

  if (config.every && !Array.isArray(config.every))
    throw new Error("'every' is a required field e.g. {every: [60, 'seconds']}")

  if (config.every && !Number.isInteger(config.every[0]))
    throw new Error("'every[0]' must be an integer")

  if (config.every && config.every[1].slice(-1) != 's')
    config.every[1] += 's'

  if (config.every && !timeUnits.includes(config.every[1]))
      throw new Error("'every[1]' is an invalid time unit. Must be one of: " + timeUnits.toString())

  if (config.at && !config.at.match(/^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/))
    throw new Error("invalid 'at' value. must use format 'HH:MM'")

  if (!config.name || !config.name.length)
    throw new Error("'name' is a required field e.g. {name: 'Daily at 00:00'}")

  if (config.notificationLists && !Array.isArray(config.notificationLists))
    throw new Error("'notificationLists' must be an array e.g. ['site-emergency']")


  var params = {
    type: "heartbeat_v2",
    name: config.name,
    rules: []
  }

  if (config.every)
    params.rules.push({
      rule_type: "run_ping_not_received",
      value: config.every[0],
      time_unit: config.every[1],
      grace_seconds: config.graceSeconds || null
    })

  if (config.at)
    params.rules.push({
      rule_type: "run_ping_not_received_at",
      value: config.at,
      grace_seconds: config.graceSeconds || null
    })


  if (config.notificationLists)
    params['notifications'] = {templates: config.notificationLists}

  return this.create(params)
})

/**
* Retrieve a set of monitors
* @params { Object } params filter params (pagination)
* @returns {Object} Array of monitors
*
*/
Monitor.prototype.filter = withApiValidation(function(params) {
  return axios
    .get(MONITOR_API_URL, {params})
    .then((res) => {
      return res.data
    })
    .catch((err) => {
      return err.response
    })
})


/**
* Read single monitor
*
* @return {Object} monitor
*/

Monitor.prototype.get = withApiValidation(function(monitorId) {
  if (!monitorId) throw new Error("You must provide a monitorId.")
  return axios
    .get(`${MONITOR_API_URL}/${monitorId}`)
    .then((res) => {
      return res.data
    })
    .catch((err) => {
      return err.response
    })

})


/**
* Update  monitor
*
* @params {Object} monitor info to update
* @return {Promise} Promise object
*/

Monitor.prototype.update = withApiValidation(function(monitorId, obj) {
  if (!monitorId) throw new Error("You must provide a monitorId.")
  return axios
    .put(`${MONITOR_API_URL}/${monitorId}`, obj)
    .then((res) => {
      return res.data
    })
    .catch((err) => {
      return err.response
    })
})

/**
* Pause  monitor
*
* @params { String} monitor code
* @return { Promise } Promise
*/

Monitor.prototype.pause = function(monitorId, time) {
  if (!monitorId) throw new Error("You must provide a monitorId.")
  var pauseURL = `${PING_API_URL}/${monitorId}/pause/${time}?auth_key=${this.apiKey}`
  return axios.get(pauseURL)
}

/**
* Unpause  monitor
*
* @params { String } monitor code
*/

Monitor.prototype.unpause = function(monitorId) {
  if (!monitorId) throw new Error("You must provide a monitorId.")
  var pauseURL = `${PING_API_URL}/${monitorId}/pause/0?auth_key=${this.apiKey}`
  return axios.get(pauseURL)
}



/**
* Delete  monitor
*
* @params { String} monitor code
* @return { Promise } Promise object
*/

Monitor.prototype.delete = withApiValidation(function(monitorId) {
  if (!monitorId) throw new Error("You must provide a monitorId.")
  return axios
    .delete(`${MONITOR_API_URL}/${monitorId}`)
    .catch((err) => {
      return err.response
    })
})


function Heartbeat(options={}) {
  if (typeof options === 'string') options = {monitorId: options}
  if (!options.monitorId)
    throw new Error("You must initialize Heartbeat with a monitorId.")

  this._state = { loopCount: 0 }
  this._ping = new Ping(options)
  this.intervalSeconds = Math.max(options.intervalSeconds || 60, 10)
  this.intervalId = setInterval(this._flush.bind(this), this.intervalSeconds * 1000)
}

Heartbeat.prototype.tick = function(count=1) {
  this._state.loopCount += count
}

Heartbeat.prototype.stop = function() {
  clearInterval(this.intervalId)
  this.intervalId = null
  if (this._state.loopCount > 0) {
    this._flush()
  }
}

Heartbeat.prototype.fail = function() {
  this.stop()
  this._ping.fail()
}

Heartbeat.prototype._flush = function() {
  // reset loop count to 0 each time we flush
  const loopCount = this._state.loopCount
  this._state.loopCount = 0
  this._ping.tick({count: loopCount, duration: this.intervalSeconds})
}


/** PING API **/

function Ping(options={}) {
  if (typeof options === 'string') options = {monitorId: options}
  if (!options.monitorId) throw new Error("You must provide a monitorId.")
  this.monitorId = options.monitorId
  this.apiKey = options.apiKey || null
}

/**
* Endpoint methods

* @params { String || Object } obj
* @return { Promise } Promise object
*/
const ENDPOINTS = ['run', 'complete', 'fail', 'ok', 'tick']
ENDPOINTS.forEach((endpoint) => {
  Ping.prototype[endpoint] = function(obj) {
    let params = cleanParams.call(this, obj)
    return axios.get(buildUrl(endpoint, this.monitorId, params))
  }
})


/** Utitly Functions **/
function withApiValidation(func) {
  if (!this.apiKey) new Error("You must initialize your Monitor with an apiKey to call this method.")
  return func
}


function cleanParams(params) {
  params = params || {}
  let allowedParams = {
    msg: typeof params === 'string' ? params : params.message ? params.message : null,
    count: params.count || null,
    env: params.env || null,
    duration: params.duration || null,
    host: params.host ||  null,
    series: params.series || null,
    auth_key: this.apiKey
  }
  Object.keys(allowedParams).forEach((key) => (allowedParams[key] == null) && delete allowedParams[key])
  return allowedParams
}

function buildUrl(action, code, params) {
  let baseUrl = `${PING_API_URL}/${code}/${action}`
  return baseUrl + (Object.keys(params).length ? '?' + querystring.stringify(params) : '')
}

module.exports = { Monitor, Ping, Heartbeat }
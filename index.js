var querystring = require('querystring')
var axios = require("axios")


var MONITOR_API_URL = "https://cronitor.io/v3/monitors"
var PING_API_URL = "https://cronitor.link"


function Monitor(options) {
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
      this.monitorCode = res.data.code
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
    throw new Error("'exression' is a required field e.g. {expression: '0 0 * * *', name: 'Daily at 00:00}")
  if (!config.name || !config.name.length)
    throw new Error("'name' is a required field e.g. {expression: '0 0 * * *', name: 'Daily at 00:00'}")
  if (config.notificationLists && !Array.isArray(config.notificationLists))
    throw new Error("'notificationLists' must be an array e.g. ['site-emergency']")

  var params = {
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
  var timeUnits = ['seconds', 'minutes', 'hours', 'days', 'weeks']

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

Monitor.prototype.get = withApiValidation(function(monitorCode) {
  return axios
    .get(`${MONITOR_API_URL}/${monitorCode}`)
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

Monitor.prototype.update = withApiValidation(function(monitorCode, obj) {
  return axios
    .put(`${MONITOR_API_URL}/${monitorCode}`, obj)
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

Monitor.prototype.pause = function(monitorCode, time) {
  var pauseURL = `${PING_API_URL}/${monitorCode}/pause/${time}?auth_key=${this.apiKey}`
  return axios.get(pauseURL)
}

/**
* Unpause  monitor
*
* @params { String } monitor code
*/

Monitor.prototype.unpause = function(monitorCode) {
  var pauseURL = `${PING_API_URL}/${monitorCode}/pause/0?auth_key=${this.apiKey}`
  return axios.get(pauseURL)
}



/**
* Delete  monitor
*
* @params { String} monitor code
* @return { Promise } Promise object
*/

Monitor.prototype.delete = withApiValidation(function(monitorCode) {
  return axios
    .delete(`${MONITOR_API_URL}/${monitorCode}`)
    .catch((err) => {
      return err.response
    })
})




/** PING API **/

function Ping(options) {
  this.authKey = options.authKey || null
  axios.defaults.headers.common['Authorization'] = 'Basic ' + new Buffer(this.apiKey + ':').toString('base64')
}



/**
* Call run endpoint

* @params { String } message
* @return { Promise } Promise object
*/

Ping.prototype.run = function(monitorCode, message) {
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'run', monitorCode, message, this.authKey))
  return axios.get(finalURL)
}


/**
* Call complete endpoint
*
* @params { String } message
* @return { Promise } Promise object
*/

Ping.prototype.complete = function(monitorCode, message) {
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'complete', monitorCode, message, this.authKey))
  return axios.get(finalURL)
}


/**
* Call fail endpoint
*
* @params { String } message
* @return { Promise } Promise object
*/
Ping.prototype.fail = function(monitorCode, message) {
  var finalURL = buildUrl(buildUrlObj(PING_API_URL, 'fail', monitorCode, message, this.authKey))
  return axios.get(finalURL)
}

/**
 *
 * Utitly Functions
 *
 */

function withApiValidation(func) {
  if (!this.apiKey)
    new Error("You must initialize cronitor with a apiKey to call this method.")
  return func
}


function buildUrlObj (baseUrl, action, code, msg, authKey) {
  var urlObj = {
    basePath: baseUrl + '/' + code + '/' + action,
  }

  if (authKey || msg) {
    urlObj.qs = {}
    if (authKey) {
      urlObj.qs.auth_key = authKey
    }
    if (msg) {
      urlObj.qs.msg = msg
    }
  }

  return urlObj
}

function buildUrl(urlObj) {
  var url = urlObj.basePath + (urlObj.qs ? '?' + querystring.stringify(urlObj.qs) : '')
  return url
}


module.exports = { Monitor, Ping }
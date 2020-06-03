var querystring = require('querystring')
var nock = require('nock')
var chai = require('chai')
var sinon = require('sinon')
var sinonChai = require("sinon-chai")
var sinonStubPromise = require('sinon-stub-promise')
sinonStubPromise(sinon)
var expect = chai.expect
chai.use(sinonChai)

var { Monitor, Ping, Heartbeat } = require('../index')
var pingApiKey = '12345'
var authQs = '?auth_key=' + pingApiKey
var msg = 'a message'
var dummyId = 'd3x0c1'
var baseUrl = 'https://cronitor.link'
var apiKey = '1337hax0r'

var newMonitorFixture = {
  "name": "Testing_Cronitor_Client",
  "notifications": {
      "phones": [],
      "webhooks": [],
      "emails": [
          "support@example.com"
      ]
  },
  "rules": [
      {
          "rule_type": "not_run_in",
          "duration": 1,
          "time_unit": "minutes"
      },
      {
          "rule_type": "ran_longer_than",
          "duration": 1,
          "time_unit": "minutes"
      }
  ],
  "note": "Created by monitor.io node.js client: version 2"
}

describe('Ping API', function() {
  var ping = new Ping({monitorId: dummyId})
  var pingAuthed = new Ping({monitorId: dummyId, apiKey: pingApiKey})
  var endpoints = ['run', 'complete', 'fail', 'tick', 'ok']

  endpoints.forEach((endpoint) => {
    context(`${endpoint.toUpperCase()} Endpoint`, function() {
      beforeEach(function(done) {
        nock('https://cronitor.link')
          .get(`/${dummyId}/${endpoint}`)
          .reply(200)
          .get(`/${dummyId}/${endpoint}?msg=${msg}`)
          .reply(200)
          .get(`/${dummyId}/${endpoint}?auth_key=${pingApiKey}`)
          .reply(200)

        done()
      })

      this.afterAll(function() {
        nock.cleanAll()
        nock.enableNetConnect()
      })

      it(`calls ${endpoint} correctly`, function(done) {
        ping[endpoint]().then((res) => {
          expect(res.status).to.eq(200)
          done()
        })
      })

      it(`calls ${endpoint} correctly with message`, function(done) {
        ping[endpoint](msg).then((res) => {
          expect(res.status).to.eq(200)
          expect(res.config.url).to.contain(`?msg=a%20message`)
          done()
        })
      })

      it(`authed calls ${endpoint} correctly`, function(done) {
        pingAuthed[endpoint]().then((res) => {
          expect(res.status).to.eq(200)
          expect(res.config.url).to.contain(`?auth_key=${pingApiKey}`)
          done()
        })
      })
    })
  })

  context("without a monitorId", function(done) {
    it("should raise an exception", function (done) {
      expect(function() {
        new Ping().to.throw(new Error("You must provide a monitorId."))
      })
      done()
    })
  })
})


describe("Heartbeat", function(done) {
  let heartbeat, clock
  beforeEach(function() {
    clock = sinon.useFakeTimers();
    heartbeat = new Heartbeat({monitorId: dummyId})
  })
  afterEach(function() {
    clock.restore()
  })
  context("constructor", function() {
    it("should set initial values", function() {
        expect(heartbeat._state.callCount).to.eq(0)
        expect(heartbeat._state.reportedCallCount).to.eq(0)
        expect(heartbeat._ping).to.be.instanceOf(Ping)
        expect(heartbeat.intervalSeconds).to.eq(60)
        expect(heartbeat.intervalId).to.exist
    })

    it("should set intervalSeconds to provided value", function() {
      heartbeat = new Heartbeat({intervalSeconds: 30, monitorId: dummyId})
      expect(heartbeat.intervalSeconds).to.eq(30)
    })

    context("when no monitorId is provided", function() {
      it("should raise an exception if a monitorId is not provided", function() {
        expect(function() {
          new Heartbeat().to.throw(new Error("You must initialize Heartbeat with a monitorId."))
        })
      })
    })
    context("when monitorId is passed as a string", function() {
      it("should use defaults", function() {
        heartbeat = new Heartbeat(dummyId)
        expect(heartbeat._state.callCount).to.eq(0)
        expect(heartbeat._state.reportedCallCount).to.eq(0)
        expect(heartbeat._ping).to.be.instanceOf(Ping)
        expect(heartbeat.intervalSeconds).to.eq(60)
        expect(heartbeat.intervalId).to.exist
      })
    })

    context("when an apiKey is passed", function() {
      it("should include auth_key in the api call", function() {
        heartbeat = new Heartbeat({monitorId: dummyId})
      })
    })
  })

  context("tick", function() {
    it("should increase the called count", function() {
      expect(heartbeat._state.callCount).to.eq(0)
      heartbeat.tick()
      expect(heartbeat._state.callCount).to.eq(1)
      heartbeat.tick()
      expect(heartbeat._state.callCount).to.eq(2)
    })
  })

  context("stop", function() {
    it("should clear the intervalId", function() {
      heartbeat.stop()
      expect(heartbeat.intervalId).to.not.exist
    })

    context("when there are unsynced calls", function() {
      it("should call _flush", function() {
        let spy = sinon.spy(heartbeat, '_flush')
        heartbeat.tick()
        heartbeat.stop()
        expect(spy.calledOnce).to.be.true
      })
    })
  })

  context("fail", function() {
    it("should stop then ping fail", function() {
      let fail = sinon.spy(heartbeat._ping, 'fail')
      let stop = sinon.spy(heartbeat, 'fail')
      heartbeat.fail()
      expect(fail.calledOnce).to.be.true
      expect(stop.calledOnce).to.be.true
    })
  })

  context("_flush", function() {
    it("should ping tick with number of calls since last tick", function() {
      pingTick = sinon.spy(heartbeat._ping, 'tick')
      heartbeat.tick()
      heartbeat._flush()
      expect(pingTick).to.have.been.called
      // TODO
      // expect(pingTick).to.have.been.calledWith({count: 1, duration: heartbeat.intervalSeconds})
    })

    it("should increment the reportedCalledCount", function() {
      let stub = sinon.stub(heartbeat._ping, 'tick').returnsPromise().resolves({})
      heartbeat.tick()
      expect(heartbeat._state.callCount).to.eq(1)
      expect(heartbeat._state.reportedCallCount).to.eq(0)
      heartbeat._flush()
      expect(heartbeat._state.reportedCallCount).to.eq(heartbeat._state.callCount)
    })
  })
})

// run integration tests against a production account
if (process.env.MONITOR_API_KEY) {
  describe("Integration Tests", function() {
    var monitor = new Monitor({apiKey: process.env.MONITOR_API_KEY})
    var cronMonitor = {
      "name": "Testing_Cronitor_Client_Cron",
      "type": "cron",
      "rules": [
          {
            "rule_type": "not_on_schedule",
            "value": '0 0 * * *',
          }
      ]
    }
    var heartbeatMonitor = {
      "name": "Testing_Cronitor_Client_Heartbeat",
      "type": "heartbeat_v2",
      "rules": [
        {
          "rule_type": "not_run_in",
          "value": "1",
          "time_unit": "hours"
        }
      ]
    }

    it ("should create a heartbeat monitor and delete it", function(done) {
      monitor.create(heartbeatMonitor)
        .then((res) => {
          expect(res.code).not.to.be.null
          expect(res.type).to.eq(heartbeatMonitor.type)
          monitor.delete()
          done()
        })
    })

    it ("should create a cron monitor and delete it", function(done) {
      monitor.create(cronMonitor)
        .then((res) => {
          expect(res.code).not.to.be.null
          expect(res.type).to.eq(cronMonitor.type)
          monitor.delete()
          done()
        })
    })

    it("should create a cron monitor with the sugar syntax", function(done) {
      monitor.createCron({
        expression: '0 0 * * *',
        name: 'Testing_Cronitor_Client_SugarCron',
        notificationLists: ['site-emergency'],
        graceSeconds: 60
      })
      .then((res) => {
        expect(res.code).not.to.be.null
        expect(res.rules[0].rule_type).to.eq('not_on_schedule')
        expect(res.rules[0].value).to.eq('0 0 * * *')
        monitor.delete()
        done()
      })
    })

    it("should create a heartbeat monitor with the every syntax", function(done) {
      monitor.createHeartbeat({
        name: "Queue Worker Heartbeat",
        every: [5, 'minutes'],
        notificationLists: ['site-emergency'],
        graceSeconds: 60
      })
      .then((res) => {
        expect(res.code).not.to.be.null
        expect(res.rules[0].rule_type).to.eq('run_ping_not_received')
        expect(res.rules[0].value).to.eq(5)
        expect(res.rules[0].grace_seconds).to.eq(60)
        monitor.delete()
        done()
      })
    })

    it("should create a heartbeat monitor with the at syntax", function(done) {
      monitor.createHeartbeat({
        name: "Not pinged at 12:05",
        at: '00:00',
        notificationLists: ['site-emergency'],
        graceSeconds: 60
      })
      .then((res) => {
        expect(res.code).not.to.be.null
        expect(res.rules[0].rule_type).to.eq('run_ping_not_received_at')
        expect(res.rules[0].value).to.eq('00:00')
        monitor.delete()
        done()
      })
    })
  })
} else {

  describe("Monitor API ", function() {
    var existingMonitorCode = null
    var cronitor = null

    describe("Create Monitor", function() {
      context("with a valid apiKey", function() {
        var monitor = new Monitor({apiKey})

        it("should create a monitor", function(done) {
          nock('https://cronitor.io')
            .post('/v3/monitors')
            .reply(201, {...newMonitorFixture, code: dummyId})

            monitor.create(newMonitorFixture).then((res) => {
            expect(res['code']).to.eq(dummyId)
            done()
          })
        })

        context("with an invalid monitor payload", function() {
          it("should return a validation error", function() {
            var invalidPayload = {...newMonitorFixture}
            delete invalidPayload['rules']
            nock('https://cronitor.io')
              .post('/v3/monitors')
              .reply(400, {"name": ["Name is required"]})

            monitor.create(newMonitorFixture)
              .then((res) => { })
              .catch((err) => {
                expect(err.status).to.eq(400)
                expect(err.data).to.eq({'name:': ["Name is required"]})
              })
          })
        })
      })

      context("without a apiKey", function(done) {
        it("should raise an exception", function (done) {
          expect(function() {
            new Monitor({code: dummyId}).to.throw(new Error("You must provide a apiKey to create a monitor."))
          })
          done()
        })
      })
    })


    describe("Retrieve Monitors", function() {
      describe("List", function() {
        let monitor

        context("with a valid apiKey", function() {
          beforeEach(function(done) {
            monitor = new Monitor({apiKey})
            done()
          })

          it("should retrieve a list of monitors", function(done) {
            nock('https://cronitor.io')
              .get('/v3/monitors')
              .reply(200, {monitors: [{...newMonitorFixture, code: dummyId}, {...newMonitorFixture, code: "foo"}]})

            monitor.filter().then((res) => {
              expect(res.monitors.length).to.eq(2)
              expect(res.monitors[0].code).to.eq(dummyId)
              expect(res.monitors[1].code).to.eq("foo")
              done()
            })
          })

          it("should fetch the specified page of data", function(done) {
            nock('https://cronitor.io')
              .get('/v3/monitors?page=2')
              .reply(200, {page: 2, monitors: [{...newMonitorFixture, code: dummyId}, {...newMonitorFixture, code: "foo"}]})

            monitor.filter({page: 2}).then((res) => {
              expect(res.page).to.eq(2)
              expect(res.monitors.length).to.eq(2)
              expect(res.monitors[0].code).to.eq(dummyId)
              expect(res.monitors[1].code).to.eq("foo")
              done()
            })
          })
        })
      })

      describe("Individual", function() {
        var cronitor
        context("with a valid apiKey", function() {
          beforeEach(function(done) {
            nock('https://cronitor.io')
              .get('/v3/monitors/' + dummyId)
              .reply(200, {...newMonitorFixture, code: dummyId})
            done()
          })

          it("should retrieve a monitor", function(done) {
            monitor = new Monitor({apiKey})
            monitor.get(dummyId).then((res) => {
              expect(res['code']).to.eq(dummyId)
              done()
            })

          })
        })
      })
    })


    describe("Update Monitor", function() {
      context("with apiKey", function() {
        context("and monitor code", function() {
          beforeEach(function(done){
            nock('https://cronitor.io')
              .put('/v3/monitors/'+ dummyId)
              .reply(200, {...newMonitorFixture, code: dummyId})
            done()
          })

          it("should update a monitor", function(done) {
            var monitor = new Monitor({apiKey: apiKey})
            monitor.update(dummyId, newMonitorFixture).then((res) => {
              expect(res['code']).to.eq(dummyId)
              done()
            })
          })
        })

        context("and without monitor code", function(done) {
          var monitor = new Monitor({apiKey})
          it("should raise an exception", function (done) {
            expect(function() {
              monitor.update(null, {}).to.throw(new Error("You must provide a monitor code to update a monitor."))
            })
            done()
          })
        })
      })
    })


    describe("Delete Monitor", function() {
      context("with apiKey", function() {
        context("and monitor code", function() {
          beforeEach(function(done){
            nock('https://cronitor.io')
              .delete('/v3/monitors/'+ dummyId)
              .reply(204)
            done()
          })

          it("should delete a monitor", function(done) {
            var monitor = new Monitor({apiKey})
            monitor.delete(dummyId).then((res) => {
              expect(res.status).to.eq(204)
              done()
            })
          })
        })

        context("and without monitor code", function(done) {
          var cronitor = new Monitor({apiKey})
          it("should raise an exception", function (done) {
            expect(function() {
              monitor.delete().to.throw(new Error("You must provide a monitor code to delete a monitor."))
            })
            done()
          })
        })
      })
    })

    describe("Pause Endpoint", function() {
      var monitor = new Monitor({apiKey})

      it('calls pause correctly', function(done) {
        nock('https://cronitor.link')
          .get(`/${dummyId}/pause/5?auth_key=${monitor.apiKey}`)
            .reply(200)

          monitor.pause(dummyId, 5).then((res) => {
          expect(res.status).to.eq(200)
          done()
        })
      })

      it('calls unpause correctly', function(done) {
        nock('https://cronitor.link')
            .get(`/${dummyId}/pause/0?auth_key=${monitor.apiKey}`)
            .reply(200)
        monitor.unpause(dummyId).then((res) => {
          expect(res.status).to.eq(200)
          done()
        })
      })
    })
  })
}


const querystring = require('querystring')
, nock = require('nock')
, chai = require('chai')
, sinon = require('sinon')
, sinonChai = require("sinon-chai")
, sinonStubPromise = require('sinon-stub-promise')
, expect = chai.expect

sinonStubPromise(sinon)
chai.use(sinonChai)

const { Monitor, Ping, Heartbeat } = require('../index')
const pingApiKey = '12345'
const authQs = '?auth_key=' + pingApiKey
const msg = 'a message'
const dummyId = 'd3x0c1'
const baseUrl = 'https://cronitor.link'
const apiKey = '1337hax0r'

const newMonitorFixture = {
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
  const ping = new Ping({monitorId: dummyId})
  const pingAuthed = new Ping({monitorId: dummyId, apiKey: pingApiKey})
  const endpoints = ['run', 'complete', 'fail', 'tick', 'ok']

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

  context("without a monitorId", function() {
    it("should raise an exception", function () {
      let fnc = function() { new Ping() };
      expect(fnc).to.throw("You must provide a monitorId.")
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
        expect(heartbeat._state.loopCount).to.eq(0)
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
        let fnc = function() { new Heartbeat() }
        expect(fnc).to.throw("You must initialize Heartbeat with a monitorId.")
      })
    })
    context("when monitorId is passed as a string", function() {
      it("should use defaults", function() {
        heartbeat = new Heartbeat(dummyId)
        expect(heartbeat._state.loopCount).to.eq(0)
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
      expect(heartbeat._state.loopCount).to.eq(0)
      heartbeat.tick()
      expect(heartbeat._state.loopCount).to.eq(1)
      heartbeat.tick()
      expect(heartbeat._state.loopCount).to.eq(2)
      heartbeat.tick(0)
      expect(heartbeat._state.loopCount).to.eq(2)
      heartbeat.tick(5)
      expect(heartbeat._state.loopCount).to.eq(7)
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

    it("should reset the loopCount", function() {
      let stub = sinon.stub(heartbeat._ping, 'tick').returnsPromise().resolves({})
      heartbeat.tick()
      expect(heartbeat._state.loopCount).to.eq(1)
      heartbeat._flush()
      expect(heartbeat._state.loopCount).to.eq(0)
    })
  })
})

// run integration tests against a production account
if (process.env.MONITOR_API_KEY) {
  describe("Integration Tests", function() {
    const monitor = new Monitor({apiKey: process.env.MONITOR_API_KEY})
    const cronMonitor = {
      "name": "Testing_Cronitor_Client_Cron",
      "type": "cron",
      "rules": [
          {
            "rule_type": "not_on_schedule",
            "value": '0 0 * * *',
          }
      ]
    }
    const heartbeatMonitor = {
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
      monitor.createHeartbeat.bind(monitor, {
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
      monitor.createHeartbeat.bind(monitor, {
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
    const existingMonitorCode = null
    const cronitor = null

    describe("Create Monitor", function() {
      context("with a valid apiKey", function() {
        const monitor = new Monitor({apiKey})

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
            const invalidPayload = {...newMonitorFixture}
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

        context("Create Cron Monitor", function() {
          it("should include an expression", function() {
            expect(monitor.createCron.bind(monitor, {name: "New Cron"})).to.throw("'expression' is a required field e.g. {expression: '0 0 * * *', name: 'Daily at 00:00}")
          })

          it("should include a name", function() {
            expect(monitor.createCron.bind(monitor, {expression: "* * * * *"})).to.throw("'name' is a required field e.g. {expression: '0 0 * * *', name: 'Daily at 00:00'}")
          })

          it("should validate notificationLists is an array", function() {
            expect(
              monitor.createCron.bind(monitor, {expression: "* * * * *",
                name: "Test Cron",
                notificationLists: "foo"
              })).to.throw("'notificationLists' must be an array e.g. ['site-emergency']")
          })

          it("should call create with the correct parameters", function() {
            let spy = sinon.spy(monitor, 'create')
            monitor.createCron({name: "Test Cron", expression: '* * * * *'})
            expect(spy).to.have.been.calledWith({
              name: "Test Cron",
              type: "cron",
              rules: [
                {
                  rule_type: "not_on_schedule",
                  value: '* * * * *',
                  grace_seconds: null
                }
              ]
            })
            spy.restore()
          })
        })

        context("Create Heartbeat Monitor", function() {
          it("should include every or at key", function() {
            expect(monitor.createHeartbeat.bind(monitor, {name: "test heartbeat"})).to.throw("missing required field 'every' or 'at'")
          })
          it("should validate every is an Array", function() {
            expect(monitor.createHeartbeat.bind(monitor, {name: "test heartbeat", every: ""})).to.throw("missing required field 'every' or 'at'")
          })
          it("should validate every[0] is an integer", function() {
            expect(monitor.createHeartbeat.bind(monitor, {name: "test heartbeat", every:["foo", "minute"]})).to.throw("'every[0]' must be an integer")
          })

          it("should validate timeunit", function() {
            expect(monitor.createHeartbeat.bind(monitor, {name: "test heartbeat", every:[1, "century"]})).to.throw
          })

          it("should pluralize timeunit", function() {
            expect(monitor.createHeartbeat.bind(monitor, {name: "test heartbeat", every:[1, "century"]})).not.to.throw
          })

          it("should include a name", function() {
            expect(monitor.createHeartbeat.bind(monitor, {every: [1, 'day']})).to.throw("'name' is a required field e.g. {name: 'Daily at 00:00'}")
          })

          it("should validate at is a valid 24hr time of day", function() {
            expect(monitor.createHeartbeat.bind(monitor, {at: '25:00'})).to.throw("invalid 'at' value. must use format 'HH:MM'")
            expect(monitor.createHeartbeat.bind(monitor, {at: '23:61'})).to.throw("invalid 'at' value. must use format 'HH:MM'")
            expect(monitor.createHeartbeat.bind(monitor, {at: 'foo'})).to.throw("invalid 'at' value. must use format 'HH:MM'")
          })

          it("should validate notificationLists is an array", function() {
            expect(
              monitor.createHeartbeat.bind(monitor, {
                name: "Test Heartbeat",
                every: [1, 'hour'],
                notificationLists: "foo"
            })).to.throw("'notificationLists' must be an array e.g. ['site-emergency']")
          })

          it("should call create with the correct parameters", function() {
            let spy = sinon.spy(monitor, 'create')
            monitor.createHeartbeat({name: "Test Heartbeat", every: [1, 'hour']})
            expect(spy).to.have.been.calledWith({
              name: "Test Heartbeat",
              type: "heartbeat_v2",
              rules: [
                {
                  rule_type: "run_ping_not_received",
                  value: 1,
                  time_unit: 'hours',
                  grace_seconds: null
                }
              ]
            })
            spy.restore()
          })
        })
      })

      context("without a apiKey", function() {
        it("should raise an exception", function () {
          let fnc = function() { new Monitor({monitorId: dummyId})}
          expect(fnc).to.throw("You must provide an apiKey.")
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
        context("with a valid apiKey", function() {
          beforeEach(function(done) {
            nock('https://cronitor.io')
              .get('/v3/monitors/' + dummyId)
              .reply(200, {...newMonitorFixture, code: dummyId})
            done()
          })

          it("should retrieve a monitor", function(done) {
            const monitor = new Monitor({apiKey})
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
            const monitor = new Monitor({apiKey: apiKey})
            monitor.update(dummyId, newMonitorFixture).then((res) => {
              expect(res['code']).to.eq(dummyId)
              done()
            })
          })
        })

        context("and without monitor code", function(done) {
          const monitor = new Monitor({apiKey})
          it("should raise an exception", function (done) {
            expect(monitor.update).to.throw("You must provide a monitorId.")
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
            const monitor = new Monitor({apiKey})
            monitor.delete(dummyId).then((res) => {
              expect(res.status).to.eq(204)
              done()
            })
          })
        })

        context("and without monitor code", function(done) {
          const monitor = new Monitor({apiKey})
          it("should raise an exception", function () {
            expect(monitor.delete).to.throw("You must provide a monitorId.")
          })
        })
      })
    })

    describe("Pause Endpoint", function() {
      const monitor = new Monitor({apiKey})

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


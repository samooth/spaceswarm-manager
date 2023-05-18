const { asBuffer, asHex } = require('hexkey-utils')
const { EventEmitter } = require('events')

class Manager extends EventEmitter {
  constructor (swarm) {
    super()
    this.swarm = swarm
    this._servedCounters = new Map()
    this._replicatedCounters = new Map()
  }

  serve (discoveryKey) {
    const key = asHex(discoveryKey)
    const prev = this._servedCounters.get(key) || 0
    this._servedCounters.set(key, prev + 1)

    if (prev === 0) {
      this.swarm.join(asBuffer(discoveryKey), { server: true, client: true })
    }
  }

  async unserve (discoveryKey) {
    const key = asHex(discoveryKey)
    const prev = this._servedCounters.get(key) || 0
    if (prev <= 0) throw new Error('Cannot unserve non-served key')

    this._servedCounters.set(key, prev - 1)

    if (prev === 1) {
      // TODO: ensure no race conditions
      // (reasoning: swarm.leave need not be awaited for it to update the swarm's topics,
      // so we can first delete, then rejoin as client if needed, avoiding some race conditions)
      const delProm = this.swarm.leave(asBuffer(discoveryKey))
      if (this._replicatedCounters.get(key) > 0) {
        this.swarm.join(asBuffer(discoveryKey), { server: false, client: true })
      }
      await delProm
    }
  }

  request (discoveryKey) {
    const key = asHex(discoveryKey)
    const prev = this._replicatedCounters.get(key) || 0
    this._replicatedCounters.set(key, prev + 1)

    const nrServed = this._servedCounters.get(key) || 0
    if (prev === 0 && nrServed <= 0) { // serving includes requesting
      this.swarm.join(asBuffer(discoveryKey), { server: false, client: true })
    }
  }

  async unrequest (discoveryKey) {
    const key = asHex(discoveryKey)
    const prev = this._replicatedCounters.get(key) || 0

    if (prev <= 0) throw new Error('Cannot unrequest non-requested key')

    this._replicatedCounters.set(key, prev - 1)

    if (prev === 1) {
      const nrServed = this._servedCounters.get(key) || 0
      if (nrServed <= 0) {
        await this.swarm.leave(asBuffer(discoveryKey))
      }
    }
  }

  get requestedKeys () {
    const topicObjs = this.swarm.topics()

    const res = Array.from(topicObjs)
      .filter((topicObj) => topicObj.isClient && !topicObj.isServer)
      .map((topicObj) => topicObj.topic)

    return res
  }

  get servedKeys () {
    const topicObjs = this.swarm.topics()

    const res = Array.from(topicObjs)
      .filter((topicObj) => topicObj.isServer)
      .map((topicObj) => topicObj.topic)

    return res
  }

  get keys () {
    return Array.from(this.swarm.topics()).map(t => t.topic)
  }

  async close () {
    await this.swarm.destroy()
  }
}

module.exports = Manager

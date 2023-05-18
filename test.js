const test = require('brittle')
const ram = require('random-access-memory')
const Corestore = require('corestore')
const createTestnet = require('@hyperswarm/testnet')
const Hyperswarm = require('hyperswarm')
const b4a = require('b4a')
const safetyCatch = require('safety-catch')

const Manager = require('.')

const ENTRY = 'Core entry'
const OPTS = { timeout: 50, valueEncoding: 'utf-8' }

test('can serve and request core', async t => {
  const { manager, manager2, store2, core } = await setup(t)

  manager.serve(core.discoveryKey)
  await manager.swarm.flush()

  const clientCore = store2.get(core.key)
  await clientCore.ready()
  manager2.request(clientCore.discoveryKey)

  t.alike(await clientCore.get(0, OPTS), ENTRY)

  manager2.request(clientCore.discoveryKey)
  t.is(await clientCore.get(0, OPTS), ENTRY)
})

test('properties', async t => {
  const { manager } = await setup(t)
  const key1 = b4a.from('a'.repeat(64), 'hex')
  const key2 = b4a.from('b'.repeat(64), 'hex')

  manager.serve(key1)
  manager.request(key2)

  t.alike(manager.keys.sort(), [key1, key2])
  t.alike(manager.requestedKeys, [key2])
  t.alike(manager.servedKeys, [key1])
})

test('requested core not announced', async t => {
  const { manager, manager2, store2, core } = await setup(t)

  const clientCore = store2.get(core.key)
  await clientCore.ready()

  // Not announced on request
  manager.request(core.discoveryKey)
  await manager.swarm.flush()
  manager2.request(clientCore.discoveryKey)
  await manager2.swarm.flush()

  await t.exception(clientCore.get(0, OPTS), /Request timed out/)
})

test('request flow', async t => {
  const { manager, manager2, store2, core } = await setup(t)

  const clientCore = store2.get(core.key)
  await clientCore.ready()
  const key = clientCore.discoveryKey

  manager.serve(core.discoveryKey)
  await manager.swarm.flush()

  // Request -> available
  manager2.request(clientCore.discoveryKey)
  await manager2.swarm.flush()
  t.is(await clientCore.get(0, OPTS), ENTRY)

  // Unrequest -> No longer looking
  await manager2.unrequest(clientCore.discoveryKey)
  t.alike(manager2.keys, [])

  // serve and req -> looking
  manager2.request(key)
  manager2.serve(key)
  t.alike(manager2.keys, [key])

  // unserve -> still looking
  await manager2.unserve(key)
  t.alike(manager2.servedKeys, [])
  t.alike(manager2.requestedKeys, [key])

  // Also unrequest -> no longer looking
  await manager2.unrequest(key)
  t.alike(manager2.requestedKeys, [])
})

test('throws when unserving/unrequesting non-served key', async t => {
  const { manager, core } = await setup(t)

  t.exception(manager.unserve(core.discoveryKey), /Cannot unserve non-served key/)
  t.exception(manager.unrequest(core.discoveryKey), /Cannot unrequest non-requested key/)
})

test('chaos 1', async t => {
  const { manager, manager2, store2, core } = await setup(t)

  const clientCore = store2.get(core.key)
  await clientCore.ready()
  const key = clientCore.discoveryKey

  manager.serve(core.discoveryKey)
  await manager.swarm.flush()

  const reps = 10
  const proms = []
  for (let i = 0; i < reps; i++) {
    manager2.serve(key)
    proms.push(manager2.unserve(key))
    manager2.request(key)
    proms.push(manager2.unrequest(key))
  }

  await Promise.all(proms)
  t.alike(manager2.servedKeys, [])
  t.alike(manager2.requestedKeys, [])
})

test('chaos 2', async t => {
  const { manager, manager2, store2, core } = await setup(t)

  const clientCore = store2.get(core.key)
  await clientCore.ready()
  const key = clientCore.discoveryKey

  manager.serve(core.discoveryKey)
  await manager.swarm.flush()

  manager2.request(key)

  const reps = 10
  const proms = []
  for (let i = 0; i < reps; i++) {
    manager2.serve(key)
    proms.push(manager2.unserve(key))
    manager2.request(key)
    proms.push(manager2.unrequest(key))
  }

  await Promise.all(proms)
  t.alike(manager2.servedKeys, [])
  t.alike(manager2.requestedKeys, [key])

  await manager2.unrequest(key)
  t.alike(manager2.requestedKeys, [])
})

function setupSwarm (store, opts) {
  const swarm = new Hyperswarm(opts)

  swarm.on('connection', (socket) => {
    store.replicate(socket)
    // Note: socket errors happen frequently (when the other
    // side unexpectedly closes the socket)
    socket.on('error', safetyCatch)
  })

  return swarm
}

async function setup (t) {
  const store = new Corestore(ram)
  const store2 = new Corestore(ram)

  const testnet = await createTestnet(3)
  const bootstrap = testnet.bootstrap
  const swarm = setupSwarm(store, { bootstrap })
  const swarm2 = setupSwarm(store2, { bootstrap })

  const core = store.get({ name: 'core' })
  await core.append('Core entry')

  const manager = new Manager(swarm)
  const manager2 = new Manager(swarm2)
  t.teardown(async () => {
    await Promise.all([manager.close(), manager2.close()])
    await Promise.all([store.close(), store2.close(), testnet.destroy()])
  })
  return {
    manager,
    manager2,
    store,
    store2,
    core
  }
}

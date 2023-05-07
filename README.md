# Swarm Manager

Manage swarming hypercores by keeping track of when to start and stop swarming them.

For example, requesting a hypercore twice and unrequesting it once will mean it remains requested. Likewise, requesting and serving a hypercore and later unrequesting it will mean it remains served.

## Install
npm i swarm-manager

## API

#### `const swarmManager = new SwarmManager(swarm, corestore)`
Create a new swarm manager and sets up replication at the corestore level.

Note: the Hyperswarm's lifecycle is managed by the swarm manager, but the corestore's is not.

### Properties

#### `swarmManager.keys`
Get a list of all keys joined as either client or server.

#### `swarmManager.requestedKeys`
Get a list of all requested keys (joined as client).
Does not include keys also joined as server.

#### `swarmManager.servedKeys`
Get a list of all served keys.

### Methods
Note: the discovery key can be in any format (buffer, hex or z32).

#### `swarmManager.serve(discoveryKey)`
Increment the serve counter for the given discovery key.
If it was 0 before, the core is now served.

#### `swarmManager.requestCore(discoveryKey)`
Increment the request counter for the given discovery key.

If it was 0 before, the core is now requested.

Note: if the core was already being served, nothing changes
(serving already implies it is requested)

#### `await swarmManager.unrequestCore(discoveryKey)`
Decrement the request counter for the given discovery key.
If it is now 0 and the serve counter is 0 too, then the core will no longer be requested.


#### `await swarmManager.unserve(discoveryKey)`
Decrement the serve counter for the given discovery key.
If it is now 0, the core is no longer served.

Note that even when no longer served, the core will remain requested if its request counter is higher than 0.

#### `await swarmManager.close()`
Destroys the swarm and cleans up (does not close the corestore).

Now that I've gotten these expirements going, here's what else I've found thats interesting.

# Other interesting projects I've found

## antisota

https://anisota.net/feed

A game like, card interface to consuming your feed.

## at-me

https://at-me.fly.dev/

Explore your PDS and see what all is in there.  Or someone else's PDS.  Like the static-oauth project.


## blacksky

Blacksky is running its own infrastructure.  They've reimplemented a bunch of it in rust but the whole project has a clear philisophical and ethical vision.  Super interesting.

## github action

https://github.com/zentered/bluesky-post-action



## BFF

*Experimental ATProto BFF Framework*
https://github.com/bigmoves/bff

- Frontend framework for creating ATProto based apps
- oauth, routing, session, etc.
- the one file deno running is pretty awesome


## Leaflet

*a tool for shared writing and social publishing*

https://tangled.org/@leaflet.pub/leaflet

A more fleshed out version of the blog tool since it also has publications.

Syncs a local database with the PDS using replicache.  Much more engineering into this.

Text blocks use YJS (CRDT) synced with ProseMirror:
YJS Integration:

## pdf-fly.io-template

https://github.com/keaysma/pds-fly.io-template

Install a PDS on fly -- this won't be enough to support OAuth

## grain

* grain.social is a photo sharing platform built on atproto.*

https://tangled.org/@grain.social/grain 

monorepo

- appview, based on bff, deno
- Darkroom, image processing, rust
- Labeler, labeling service, deno
- Notifications, notifications 
- cli, rust
- Local Infrastructure (/local-infra)

This feels like the most technically complete (though not product complete) of the bunch.  I found BFF from here, and I'm interested a lot in how to setup our own PDS and App view to get everything working.

## skyware

https://skyware.js.org/

Higher level built a bot and other stuff code.

Not sure I'd use it but good code to look through.

## tangled.org

*tangled is new social-enabled git collaboration platform built on atproto.*

This is a code forge like github but built upon atproto

Many atproto projects seem to be hosted here!



## wisp

* Monorepo for Wisp.place. A static site hosting service built on top of the AT Protocol. *

https://tangled.org/@nekomimi.pet/wisp.place-monorepo


* Backend: Bun + Elysia + PostgreSQL
* Frontend: React 19 + Tailwind 4 + Radix UI
* Hosting: Node microservice using Hono
* CLI: Rust + Jacquard (AT Protocol library)
* Protocol: AT Protocol OAuth + custom lexicons

# Changelog

## [0.2.1](https://github.com/DrPrimus/ai-for-developers-project-386/compare/v0.2.0...v0.2.1) (2026-11-17)


### Documentation

* require ticket references in commits ([0b82264](https://github.com/DrPrimus/ai-for-developers-project-386/commit/0b82264da91c8201dbcbc2ea825a5a3f980f3ab7))

## [0.2.0](https://github.com/DrPrimus/ai-for-developers-project-386/compare/v0.1.0...v0.2.0) (2026-11-17)


### Features

* **api:** express meeting type duration limits in contract ([08cc58f](https://github.com/DrPrimus/ai-for-developers-project-386/commit/08cc58fd36068725aa85ddce08186a7fd2d437fe))
* **be:** add meeting type creation and listing ([b35a04b](https://github.com/DrPrimus/ai-for-developers-project-386/commit/b35a04bad81398aea8dd3dd4935d798c42e3acf9))
* **be:** book meeting slots atomically ([fe4b26d](https://github.com/DrPrimus/ai-for-developers-project-386/commit/fe4b26d3ebe0a1d6bf81a3f6fa93294cb3850e73))
* **be:** expose fourteen-day free slot calendar ([c74766b](https://github.com/DrPrimus/ai-for-developers-project-386/commit/c74766bb1824e52c73041ffcc3626a1502582029))
* **be:** serve upcoming meetings for the owner ([ab5012e](https://github.com/DrPrimus/ai-for-developers-project-386/commit/ab5012ea5545e51d35452a68c7c34bc801b50dfd))
* **fe:** add landing page with admin and booking entry points ([1b15244](https://github.com/DrPrimus/ai-for-developers-project-386/commit/1b15244d8373cd7e5232571cfb1a5988bb5e36c0)), closes [#1](https://github.com/DrPrimus/ai-for-developers-project-386/issues/1)
* **fe:** add meeting type form and list to admin page ([b7466c6](https://github.com/DrPrimus/ai-for-developers-project-386/commit/b7466c687c08b83452ed72093a1b76b8dad8a77f))
* **fe:** add vite react frontend with shadcn/ui ([efcb544](https://github.com/DrPrimus/ai-for-developers-project-386/commit/efcb544affbd606023ddc18b7e14673d7c9dcc59))
* **fe:** book slots from the guest calendar ([c5accd3](https://github.com/DrPrimus/ai-for-developers-project-386/commit/c5accd38d7ab05883c1e6caf657170c95079ee7a))
* **fe:** show guest booking calendar with free slots ([f0b6311](https://github.com/DrPrimus/ai-for-developers-project-386/commit/f0b6311177315a98479a93ce552ba61d5be170f7))
* **fe:** show upcoming meetings in admin ([e5f1375](https://github.com/DrPrimus/ai-for-developers-project-386/commit/e5f1375126f39f2655a5eba2edfe697ab33c2f63))


### Bug Fixes

* address two-axis review findings ([7f59dfc](https://github.com/DrPrimus/ai-for-developers-project-386/commit/7f59dfc97228c7f78dc21bf79506bb1a94cdbd36))
* AGENTS.md ([5bb5514](https://github.com/DrPrimus/ai-for-developers-project-386/commit/5bb5514d70e1fc833cf88caf18fde0e344d51948))


### Build System

* **api:** add TypeSpec contract with generated OpenAPI and frontend types ([6d935f7](https://github.com/DrPrimus/ai-for-developers-project-386/commit/6d935f74d5bcb3b241e637b39b7417486ab73935))


### Continuous Integration

* configure release-please for automated releases ([8d26f27](https://github.com/DrPrimus/ai-for-developers-project-386/commit/8d26f27a9834aac187087c0841186456a9c314df))
* install playwright chromium before quality gates ([02c9d0b](https://github.com/DrPrimus/ai-for-developers-project-386/commit/02c9d0bf420f8dce5e8b81990c28afd56db5a0a2))
* wire API contract into quality gates ([f34d0f7](https://github.com/DrPrimus/ai-for-developers-project-386/commit/f34d0f7b8b79de217265e1ad135b2f94853a9e46))


### Tests

* **e2e:** add playwright happy-path booking scenario ([e272a61](https://github.com/DrPrimus/ai-for-developers-project-386/commit/e272a61f50de3dc32b8c3f3c38bfa23f2b35ed76))
* **e2e:** run e2e in project check ([7d38a01](https://github.com/DrPrimus/ai-for-developers-project-386/commit/7d38a0107c678eef1e73d02abf5bd35384d5c326))
* **fe:** add http smoke test for the built page ([765da55](https://github.com/DrPrimus/ai-for-developers-project-386/commit/765da555de713998445f6c2ed063bc2eeed62315))


### Documentation

* add application spec and atomic booking research ([0ae3f08](https://github.com/DrPrimus/ai-for-developers-project-386/commit/0ae3f08d8df176e3890840f6bf6ceb97abde523a))
* add domain glossary draft ([dd949f2](https://github.com/DrPrimus/ai-for-developers-project-386/commit/dd949f29dc97af9a6bd886d5eb98a95798e658b4))
* clarify commit policy for agents ([b44b5d9](https://github.com/DrPrimus/ai-for-developers-project-386/commit/b44b5d9ca2fff6e4ef5a331b32ad5ad1d75d70a1))
* document e2e commands and playwright setup ([966f8e0](https://github.com/DrPrimus/ai-for-developers-project-386/commit/966f8e07164551e4820cbbe668e1c60393d5dd2c))
* document hk hook setup ([69718fc](https://github.com/DrPrimus/ai-for-developers-project-386/commit/69718fc48818783f4950d238ec6ffa03984ea6e6))
* require humans to create commits ([ffa81da](https://github.com/DrPrimus/ai-for-developers-project-386/commit/ffa81da4447d5402d85153eb3121c0debe2f752b))


### Miscellaneous Chores

* add hk pre-commit check ([5bc89ce](https://github.com/DrPrimus/ai-for-developers-project-386/commit/5bc89ce5e9dba71737ffd862027ba219f471319b))
* add readable check summaries for backend and frontend ([0f695c7](https://github.com/DrPrimus/ai-for-developers-project-386/commit/0f695c70b6b245f4c0eb126087398cac06c62480))
* add shared agent skills and lockfile ([8790a4d](https://github.com/DrPrimus/ai-for-developers-project-386/commit/8790a4de3d6022534f2e2f56d606f5a10ef5a36f))
* configure issue tracker and domain docs for agent skills ([0fc814f](https://github.com/DrPrimus/ai-for-developers-project-386/commit/0fc814fb6264ff4c62f083cf0e0e4305da53e461))
* merge spec/booking-calendar ([01da3aa](https://github.com/DrPrimus/ai-for-developers-project-386/commit/01da3aa21404bf295c45d3b7dc192234717d4edf))
* merge spec/booking-calendar into feat/be-11-meeting-types ([058dafd](https://github.com/DrPrimus/ai-for-developers-project-386/commit/058dafd7c381c2619d9e9a0e5dbc324fecb42366))
* merge ticket 11 meeting types ([6d25978](https://github.com/DrPrimus/ai-for-developers-project-386/commit/6d25978a295a39f74e3089defbcaa5d7b479fb2c))
* merge ticket 12 guest calendar ([661ff96](https://github.com/DrPrimus/ai-for-developers-project-386/commit/661ff966ca68c428c15a12e6b20479c7f279b345))
* merge ticket 13 booking ([0704676](https://github.com/DrPrimus/ai-for-developers-project-386/commit/0704676f22eba5061ee852968d6c852248289b4a))
* merge ticket 14 upcoming meetings ([735ed1f](https://github.com/DrPrimus/ai-for-developers-project-386/commit/735ed1f52484bc168b0eba7f0bebb2ec8df29284))
* merge ticket 15 playwright e2e ([2c1c6ee](https://github.com/DrPrimus/ai-for-developers-project-386/commit/2c1c6ee590edf47989ab065d3809aea6ce212e66))
* merge ticket 16 release-please ([cfcd5f2](https://github.com/DrPrimus/ai-for-developers-project-386/commit/cfcd5f2c3e299ef8c682ba6ccba961be093f0268))
* scope frontend ignore rules to FE ([60eaf67](https://github.com/DrPrimus/ai-for-developers-project-386/commit/60eaf675c22d3c873f9ffb44963530799a6364aa))
* wire frontend into mise, ci and pre-commit ([cfeef87](https://github.com/DrPrimus/ai-for-developers-project-386/commit/cfeef87f7c2b628958f855850169501fb246278c))

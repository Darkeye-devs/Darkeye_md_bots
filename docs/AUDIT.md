# Dark Eyes — command audit

Generated 2026-10-20T18:56:14.990Z from `docs/command-target-list.md`

## The headline

| Measure | Count | Share |
| --- | ---: | ---: |
| Commands in the target list | 1000 | 100% |
| **Implemented with real code** | **213** | **21.3%** |
| Reachable via a registered alias | 116 | 11.6% |
| Covered by an equivalent command | 73 | 7.3% |
| Not built (with reasons below) | 598 | 59.8% |

So of the 1000 names on that list, **402 do real work today**. The other 598 are listed below with the exact reason — no "coming soon" hand-waving.

| Live registry | Count |
| --- | ---: |
| Registered commands | 249 |
| Registered aliases | 211 |
| Plugin files | 19 |
| Plugin load failures | 0 |
| Commands we built that are NOT on the target list | 36 |

## Per section

| Section | Listed | Implemented | Alias | Equivalent | Missing |
| --- | ---: | ---: | ---: | ---: | ---: |
| GENERAL | 53 | 13 | 18 | 0 | 22 |
| GROUP | 68 | 30 | 9 | 0 | 29 |
| DOWNLOADERS | 62 | 25 | 0 | 8 | 29 |
| STICKER MEDIA | 68 | 19 | 4 | 4 | 41 |
| AI | 62 | 12 | 18 | 0 | 32 |
| FUN GAMES | 88 | 15 | 15 | 0 | 58 |
| REACTIONS | 38 | 38 | 0 | 0 | 0 |
| ANIME NSFWSAFE | 28 | 0 | 0 | 0 | 28 |
| TEXTMAKER | 79 | 0 | 0 | 15 | 64 |
| CONVERTERS | 55 | 5 | 7 | 28 | 15 |
| TOOLS | 73 | 13 | 11 | 8 | 41 |
| SEARCH INFO | 79 | 1 | 4 | 1 | 73 |
| ECONOMY RPG | 76 | 11 | 13 | 2 | 50 |
| AUDIO EFFECTS | 27 | 0 | 0 | 0 | 27 |
| OWNER ADMIN | 59 | 13 | 8 | 0 | 38 |
| STATUS SOCIAL | 29 | 2 | 1 | 0 | 26 |
| MISC | 56 | 16 | 8 | 7 | 25 |

## Implemented commands

`menu` · `list` · `ping` · `info` · `owner` · `rules` · `uptime` · `stats` · `me` · `id` · `rate` · `time` · `weather` · `add` · `kick` · `promote` · `demote` · `mute` · `unmute` · `warn` · `unwarn` · `warnings` · `tagall` · `hidetag` · `groupinfo` · `grouplink` · `revoke` · `setname` · `setdesc` · `setpp` · `delpp` · `announce` · `welcome` · `setwelcome` · `goodbye` · `setgoodbye` · `antilink` · `antispam` · `antiforward` · `antimedia` · `antisticker` · `poll` · `tagadmins` · `ytmp3` · `ytmp4` · `play` · `song` · `video` · `ytshort` · `tiktok` · `tiktoknowm` · `instagram` · `igdl` · `igreel` · `igphoto` · `facebook` · `fbdl` · `fbreel` · `twitter` · `twdl` · `pinterest` · `pindl` · `spotify` · `spotifydl` · `soundcloud` · `scdl` · `threads` · `reddit` · `sticker` · `take` · `toimg` · `tovideo` · `blur` · `sharpen` · `contrast` · `brighten` · `darken` · `grayscale` · `sepia` · `invert` · `mirror` · `rotate` · `resize` · `compress` · `watermark` · `circle` · `pixelate` · `ai` · `answer` · `explain` · `summarize` · `translate` · `rewrite` · `grammar` · `define` · `imagine` · `describe` · `story` · `code` · `joke` · `trivia` · `fact` · `truth` · `wyr` · `tictactoe` · `guess` · `guessnumber` · `rps` · `coinflip` · `dice` · `slots` · `8ball` · `fortune` · `ship` · `pat` · `slap` · `punch` · `bite` · `lick` · `cuddle` · `poke` · `tickle` · `wave` · `wink` · `smile` · `laugh` · `cry` · `blush` · `dance` · `sleep` · `eat` · `drink` · `cook` · `angry` · `happy` · `sad` · `bored` · `shy` · `scared` · `surprised` · `confused` · `think` · `nod` · `shrug` · `highfive` · `handhold` · `bully` · `nom` · `cringe` · `pout` · `smug` · `yawn` · `currency` · `convert` · `crypto` · `temperature` · `worldtime` · `calc` · `qr` · `shorturl` · `whois` · `dns` · `ip` · `password` · `hash` · `caesar` · `rot13` · `atbash` · `uuid` · `lorem` · `langdetect` · `balance` · `bank` · `pay` · `daily` · `work` · `fish` · `mine` · `shop` · `inventory` · `gamble` · `rob` · `broadcast` · `setbotname` · `setbotpp` · `delbotpp` · `setbotstatus` · `block` · `unblock` · `blocklist` · `backup` · `cleartmp` · `logs` · `eval` · `shell` · `getpp` · `getbio` · `afk` · `unafk` · `remind` · `reminders` · `delreminder` · `timer` · `note` · `notes` · `delnote` · `todo` · `deltodo` · `donetodo` · `readmore` · `spoiler` · `vv` · `getmedia`

## Missing commands, with reasons

### Not implemented yet — 482

`donate` · `script` · `repo` · `report` · `feedback` · `bug` · `request` · `support` · `invite` · `changelog` · `news` · `tos` · `privacy` · `setlang` · `mylink` · `botlink` · `share` · `review` · `suggest` · `vcard` · `calendar` · `start` · `ban` · `unban` · `tag` · `admins` · `listadmins` · `autoread` · `autotyping` · `autorecord` · `autoreact` · `autodl` · `slowmode` · `vote` · `endvote` · `ytsearch` · `mediafire` · `mega` · `gdrive` · `apk` · `apkdl` · `happymod` · `gitclone` · `github` · `snapchat` · `likee` · `capcut` · `telegramdl` · `vimeo` · `dailymotion` · `twitch` · `bilibili` · `imdbdl` · `tumblr` · `linkedin` · `vk` · `ok-ru` · `rumble` · `odysee` · `bandcamp` · `mixcloud` · `deezer` · `applemusic` · `tidal` · `swm` · `togif` · `tomp3` · `toaudio` · `tovn` · `tourl` · `upload` · `tourl2` · `hd` · `crop` · `round` · `meme` · `memegen` · `smeme` · `mememaker` · `trigger` · `wasted` · `wanted` · `jail` · `rip` · `gay` · `glitch` · `blurface` · `triggered` · `communism` · `comrade` · `deepfry` · `ad` · `chatgpt` · `gpt4` · `claude` · `bard` · `llama` · `copilot` · `bing` · `expand` · `text2speech` · `speech2text` · `caption` · `identify` · `solve` · `math-solve` · `homework` · `essay` · `lyrics-gen` · `song-gen` · `rap-gen` · `joke-gen` · `darkjoke` · `riddle` · `neverhaveiever` · `wordchain` · `scramble` · `unscramble` · `guessword` · `guessflag` · `guesscountry` · `guesscapital` · `guesssong` · `guessanime` · `guessmovie` · `guesslogo` · `guessemoji` · `mathquiz` · `speedtype` · `typing` · `typerace` · `lottery` · `wheel` · `spin` · `horoscope` · `zodiac` · `palm` · `compatibility` · `friendship` · `crush` · `rate-me` · `hot` · `cute` · `smart` · `dumb` · `gay-meter` · `lesbian-meter` · `beauty-meter` · `handsome-meter` · `pretty-meter` · `ugly-meter` · `iq-test` · `iqscore` · `personality` · `mbti` · `enneagram` · `anilist` · `myanimelist` · `mal` · `kitsu` · `anidb` · `watertext` · `ice` · `snow` · `snowtext` · `gold` · `silver` · `bronze` · `bronzetext` · `diamond` · `diamondtext` · `metal` · `metallic` · `3d` · `3dtext` · `3dgold` · `3dsilver` · `3dneon` · `blackpink` · `pink` · `purple` · `blue` · `green` · `red` · `yellow` · `orange` · `rainbow-text` · `graffiti` · `graffiti2` · `cartoon-text` · `comic-text` · `candy` · `candytext` · `chocolate` · `chocotext` · `cake` · `caketext` · `sand` · `sandtext` · `wood` · `woodtext` · `stone` · `stonetext` · `marble` · `marbletext` · `paper` · `cloud` · `cloudtext` · `lightning` · `thunder` · `thundertext` · `matrixtext` · `hacker` · `horror` · `blood` · `zombie` · `zombietext` · `skull` · `skulltext` · `gaming` · `gamingtext` · `logo` · `logomaker` · `logo-gen` · `esport` · `stock` · `stocks` · `gold-price` · `silver-price` · `oil-price` · `length` · `weight` · `speed-convert` · `area` · `volume` · `time-convert` · `octal` · `decimal` · `hex2dec` · `dec2hex` · `barcode` · `barcodegen` · `bitly` · `expandurl` · `linkcheck` · `urlscan` · `webinfo` · `mylocation` · `ping-site` · `checksite` · `sitestatus` · `downtime` · `speedtest` · `nettest` · `passcheck` · `encrypt` · `decrypt` · `cipher` · `vigenere` · `random-string` · `fakeaddress` · `fakename` · `fakeprofile` · `fakeemail` · `fakecard` · `tempmail` · `tempnumber` · `disposable` · `otp` · `google` · `search` · `bing-search` · `duckduckgo` · `yahoo` · `brave` · `wikipedia` · `wiki` · `wikihow` · `wikiquote` · `wikinews` · `synonym` · `antonym` · `rhyme` · `thesaurus` · `etymology` · `urban` · `urbandict` · `slang` · `pronounce` · `phonetic` · `translate-text` · `languages` · `headlines` · `breaking` · `tech-news` · `sports-news` · `business-news` · `science-news` · `health-news` · `ent-news` · `crypto-news` · `weather5` · `aqi` · `pollution` · `uv` · `sunrise` · `sunset` · `moon` · `moonphase` · `earthquake` · `volcano` · `tsunami` · `storm` · `hurricane` · `covid` · `covidstats` · `vaccine` · `disease` · `symptoms` · `medicine` · `drug` · `pharmacy` · `hospital` · `dentist` · `nearby` · `places` · `restaurants` · `cafes` · `atm` · `petrol` · `hotels` · `flights` · `train` · `bus` · `metro` · `cab` · `taxi` · `traffic` · `map` · `location` · `distance` · `route` · `deposit` · `withdraw` · `donate-coins` · `weekly` · `monthly` · `hourly` · `jobs` · `apply` · `resign` · `quit` · `dig-gold` · `chop` · `farm` · `harvest` · `plant` · `crops` · `sell` · `use` · `equip` · `unequip` · `craft` · `smelt` · `forge` · `enchant` · `repair` · `heist` · `crime` · `hack-bank` · `loan` · `repay` · `interest` · `invest` · `stocks-sim` · `crypto-sim` · `casino` · `beg` · `search-coins` · `fight-boss` · `monster` · `dungeon-run` · `raid-boss` · `pet` · `pets` · `adopt-pet` · `feed-pet` · `train-pet` · `pet-battle` · `level` · `xp` · `rank` · `bass` · `bassboost` · `treble` · `earrape` · `deep` · `fast` · `slow` · `nightcore` · `reverse-audio` · `robot` · `chipmunk` · `vibrato` · `tremolo` · `echo` · `reverb` · `chorus` · `flanger` · `phaser` · `distortion` · `normalize` · `volume-up` · `volume-down` · `mono-audio` · `stereo` · `trim-audio` · `cut-audio` · `merge-audio` · `setbotbio` · `banuser` · `unbanuser` · `banlist` · `banchat` · `unbanchat` · `listowner` · `listprem` · `listmod` · `listsudo` · `shutdown` · `update` · `upgrade-bot` · `clearcache` · `clearsession` · `clearchat-all` · `clearlogs` · `errorlogs` · `terminal` · `ls` · `cat` · `rm` · `mv` · `cp` · `minecraft` · `mcserver` · `mcskin` · `mcuser` · `steam` · `steamuser` · `xbox` · `psn` · `roblox` · `fortnite` · `pubg` · `valorant` · `lol` · `apex` · `csgo` · `dota2` · `alarm` · `bookmark` · `bookmarks` · `savemsg` · `savedmsgs` · `delsaved` · `star` · `unstar` · `starred` · `pinmsg` · `quote-msg` · `editmsg` · `delmsg` · `forward` · `fwd` · `copy` · `paste` · `clipboard` · `translate-reply` · `getsticker` · `stickersearch` · `stickerpacks` · `packinfo`

### Anime API group — planned, needs AniList/MAL wiring — 23

`anime` · `waifu` · `neko` · `husbando` · `megumin` · `shinobu` · `awoo` · `animequote` · `animenews` · `animesearch` · `animeinfo` · `animechar` · `animevoice` · `manga` · `mangasearch` · `mangainfo` · `mangaread` · `manhwa` · `manhua` · `animetrivia` · `animewall` · `animepfp` · `animeicon`

### Guard exists only where it can be enforced reliably — 17

`antidelete` · `antiviewonce` · `antibot` · `antitoxic` · `antiflood` · `antifake` · `antiporn` · `antitag` · `antimention` · `antichannel` · `antistatus` · `antiimage` · `antivideo` · `antiaudio` · `antidoc` · `antilongtext` · `antiviewonce-on`

### Game engine not built yet (tictactoe + guess + trivia shipped) — 13

`connect4` · `chess` · `checkers` · `hangman` · `wordle` · `blackjack` · `poker` · `roulette` · `bingo` · `mines` · `tower` · `crash` · `plinko`

### Partially covered by .dns/.whois/.ip — 11

`screenshot` · `ss` · `sshd` · `sstab` · `ssfull` · `ssmobile` · `portscan` · `traceroute` · `subdomain` · `headers` · `useragent`

### Social stalking APIs are unreliable/paid — 10

`stalk` · `tiktokstalk` · `igstalk` · `ghstalk` · `twstalk` · `ytstalk` · `npmstalk` · `ffstalk` · `mlstalk` · `robloxstalk`

### Paid speech/OCR API — 8

`aivoice` · `tts` · `stt` · `transcribe` · `ocr` · `readtext` · `scan` · `tts-reply`

### Single-owner model by design (config owners) — 8

`addowner` · `delowner` · `addprem` · `delprem` · `addmod` · `delmod` · `addsudo` · `delsudo`

### Covered by .broadcast variants (media broadcasts planned) — 7

`bcrypt` · `bcgroup` · `bcpm` · `bcimage` · `bcvideo` · `bcaudio` · `bcpoll`

### Animated text stickers need ffmpeg + a font renderer (planned in v2) — 6

`attp` · `ttp` · `ttp2` · `ttp3` · `ttp4` · `ttp5`

### Paid image API (remove.bg / upscaler) — 5

`removebg` · `remove-bg` · `enhance` · `upscale` · `hdr`

### Covered by .imagine (single image generator) — 5

`image-gen` · `txt2img` · `img2img` · `aiart` · `aiavatar`

### Needs a 3rd-party emoji-mix image service — 3

`emojimix` · `emoji` · `emojiquiz`

## Bonus: live commands not on the target list

`forget` · `resolve` · `platforms` · `buy` · `richlist` · `move` · `quote` · `cmd` · `session` · `shownote` · `todos` · `afklist` · `delete` · `badword` · `anticall` · `guardstatus` · `rmwarn` · `mode` · `reload` · `restart` · `joingroup` · `leavegroup` · `textmaker` · `base64` · `binary` · `hex` · `roman` · `words` · `count` · `upper` · `lower` · `reverse` · `title` · `passwordcheck` · `bmi` · `rates`

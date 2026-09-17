#!/usr/bin/env node
/* ==========================================================================
   Latte with Lata - build-index.cjs (thin alias, kept so every older note / script keeps working)
   The assembler is build-site.cjs now (PAGES-SPEC 2): it builds index.html exactly as this file used to, plus every sub-page and admin.html.
     node build-index.cjs            = node build-site.cjs            (the whole site)
     node build-index.cjs --check    = node build-site.cjs --check    (validate, write nothing)
     node build-index.cjs home       = node build-site.cjs home       (index.html only)
   Arguments and the SITE_ORIGIN env pass straight through (same process, same argv).
   ========================================================================== */
'use strict';
require('./build-site.cjs');

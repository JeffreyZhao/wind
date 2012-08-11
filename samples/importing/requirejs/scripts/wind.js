/***********************************************************************
  Author: XiNGRZ <chenxingyu92@gmail.com>

  Load all the Wind.js modules (core, compiler, async, promise - 
  builderbase would also be loaded implicitly) and returns the root
  object get from the core module.
 ***********************************************************************/

define([
    'wind-core',
    'wind-compiler',
    'wind-async',
    'wind-promise'
], function (Wind) {
    return Wind;
});
/**
 * Author: XiNGRZ <chenxingyu92@gmail.com>
 * 
 * Wind loader, returns a prepared Wind object with wind-compiler, wind-async, wind-async-powerpack initialized.
 */

define([
    'wind',
    'wind-compiler',
    'wind-async',
    'wind-async-powerpack'
], function (Wind, compiler, async, async_powerpack) {

    compiler.init();
    async.init();
    async_powerpack.init();
    
    return Wind;
});
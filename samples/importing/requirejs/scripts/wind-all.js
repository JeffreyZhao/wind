/**
 * Author: XiNGRZ <chenxingyu92@gmail.com>
 * 
 * Wind loader, returns a prepared Wind object with wind-jit, wind-async, wind-async-powerpack initialized.
 */

define([
    'wind',
    'wind-jit',
    'wind-async',
    'wind-async-powerpack'
], function (Wind, jit, async, async_powerpack) {

    jit.init();
    async.init();
    async_powerpack.init();
    
    return Wind;
});
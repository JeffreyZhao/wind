/**
 * Author: XiNGRZ <chenxingyu92@gmail.com>
 * 
 * Just a sample. Shows the given value on the Body and increases it every second.
 */

define([
	'jscex-loader'
], function(Jscex) {

	return eval(Jscex.compile("async", function(initValue) {
		while (true) {
			document.body.innerHTML = initValue++;
			$await(Jscex.Async.sleep(1000));
		}
	}));

});
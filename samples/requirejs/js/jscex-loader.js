/**
 * Author: XiNGRZ <chenxingyu92@gmail.com>
 * 
 * Jscex loader, returns a prepared Jscex object with JIT, Async, Powerpack initialized.
 */

define([
	'jscex',
	'jscex-jit',
	'jscex-async',
	'jscex-async-powerpack'
], function(Jscex, JIT, Async, Powerpack) {

	JIT.init();
	Async.init();
	Powerpack.init();
	
	return Jscex;

});
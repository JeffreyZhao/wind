/**
 * Author: XiNGRZ <chenxingyu92@gmail.com>
 * 
 * Application entry point.
 */

define(function(require) {

	var MyTestModule = require('test');
	
	var init = function() {
	
		new MyTestModule(10).start();
	
	};

	return {	
		initialize: init
	};

});
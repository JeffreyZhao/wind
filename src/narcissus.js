 /* ***** BEGIN LICENSE BLOCK *****
  * Version: MPL 1.1/GPL 2.0/LGPL 2.1
  *
  * The contents of this file are subject to the Mozilla Public License Version
  * 1.1 (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at
  * http://www.mozilla.org/MPL/
  *
  * Software distributed under the License is distributed on an "AS IS" basis,
  * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
  * for the specific language governing rights and limitations under the
  * License.
  *
  * The Original Code is the Narcissus JavaScript engine.
  *
  * The Initial Developer of the Original Code is
  * Brendan Eich <brendan@mozilla.org>.
  * Portions created by the Initial Developer are Copyright (C) 2004
  * the Initial Developer. All Rights Reserved.
  *
  * Contributor(s):
  *
  * Alternatively, the contents of this file may be used under the terms of
  * either the GNU General Public License Version 2 or later (the "GPL"), or
  * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
  * in which case the provisions of the GPL or the LGPL are applicable instead
  * of those above. If you wish to allow use of your version of this file only
  * under the terms of either the GPL or the LGPL, and not to allow others to
  * use your version of this file under the terms of the MPL, indicate your
  * decision by deleting the provisions above and replace them with the notice
  * and other provisions required by the GPL or the LGPL. If you do not delete
  * the provisions above, a recipient may use your version of this file under
  * the terms of any one of the MPL, the GPL or the LGPL.
  *
  * ***** END LICENSE BLOCK ***** */
 
 /*
  * Narcissus - JS implemented in JS.
  *
  * Well-known constants and lookup tables.  Many consts are generated from the
  * tokens table via eval to minimize redundancy, so consumers must be compiled
  * separately to take advantage of the simple switch-case constant propagation
  * done by SpiderMonkey.
  */
 
 /*
  * njs edit:
  * - Neil: combine jsdefs.js and jsparse.js into a single file as part of an
  *   effort to reduce namespace pollution.
  * - Neil: make opTypeName order explicit for env compatibility.  The original
  *   source relied on a SpiderMonkey specific behavior where object key
  *   iteration occurs in the same order in which the keys were defined in 
  *   the object.
 Ê* - Neil: perf optimizations for OOM+ parse speedup
 Ê* - Neil: make code x-env-compatible
 Ê* - chocolateboy 2006-06-01: add support for $ in identifiers and remove support for ` as the first character as per:
 Ê* Ê http://www.mozilla.org/js/language/es4/formal/lexer-semantics.html#N-InitialIdentifierCharacter and
 Ê* Ê http://www.mozilla.org/js/language/es4/formal/lexer-semantics.html#N-ContinuingIdentifierCharacter
  */

Narcissus = {};

(function() {

	// EDIT: remove references to global to avoid namespace pollution

	 // EDIT: add yielding op
	 var tokens = [
		 // End of source.
		 "END",
	 
		 // Operators and punctuators.  Some pair-wise order matters, e.g. (+, -)
		 // and (UNARY_PLUS, UNARY_MINUS).
		 "\n", ";",
		 ",",
		 "=",
		 "?", ":", "CONDITIONAL",
		 "||",
		 "&&",
		 "|",
		 "^",
		 "&",
		 "->",
		 "==", "!=", "===", "!==",
		 "<", "<=", ">=", ">",
		 "<<", ">>", ">>>",
		 "+", "-",
		 "*", "/", "%",
		 "!", "~", "UNARY_PLUS", "UNARY_MINUS",
		 "++", "--",
		 ".",
		 "[", "]",
		 "{", "}",
		 "(", ")",
	 
		 // Nonterminal tree node type codes.
		 "SCRIPT", "BLOCK", "LABEL", "FOR_IN", "CALL", "NEW_WITH_ARGS", "INDEX",
		 "ARRAY_INIT", "OBJECT_INIT", "PROPERTY_INIT", "GETTER", "SETTER",
		 "GROUP", "LIST",
	 
		 // Terminals.
		 "IDENTIFIER", "NUMBER", "STRING", "REGEXP",
	 
		 // Keywords.
		 "break",
		 "case", "catch", "const", "continue",
		 "debugger", "default", "delete", "do",
		 "else", "enum",
		 "false", "finally", "for", "function",
		 "if", "in", "instanceof",
		 "new", "null",
		 "return",
		 "switch",
		 "this", "throw", "true", "try", "typeof",
		 "var", "void",
		 "while", "with" // EDIT: remove trailing comma (breaks IE)
	 ];
	 
	 // Operator and punctuator mapping from token to tree node type name.
	 // NB: superstring tokens (e.g., ++) must come before their substring token
	 // counterparts (+ in the example), so that the opRegExp regular expression
	 // synthesized from this list makes the longest possible match.
	// EDIT: NB comment above indicates reliance on SpiderMonkey-specific
	//       behavior in the ordering of key iteration -- see EDIT below.
	// EDIT: add yeilding op
	 var opTypeNames = {
		 '\n':   "NEWLINE",
		 ';':    "SEMICOLON",
		 ',':    "COMMA",
		 '?':    "HOOK",
		 ':':    "COLON",
		 '||':   "OR",
		 '&&':   "AND",
		 '|':    "BITWISE_OR",
		 '^':    "BITWISE_XOR",
		 '&':    "BITWISE_AND",
		 '->':   "YIELDING",
		 '===':  "STRICT_EQ",
		 '==':   "EQ",
		 '=':    "ASSIGN",
		 '!==':  "STRICT_NE",
		 '!=':   "NE",
		 '<<':   "LSH",
		 '<=':   "LE",
		 '<':    "LT",
		 '>>>':  "URSH",
		 '>>':   "RSH",
		 '>=':   "GE",
		 '>':    "GT",
		 '++':   "INCREMENT",
		 '--':   "DECREMENT",
		 '+':    "PLUS",
		 '-':    "MINUS",
		 '*':    "MUL",
		 '/':    "DIV",
		 '%':    "MOD",
		 '!':    "NOT",
		 '~':    "BITWISE_NOT",
		 '.':    "DOT",
		 '[':    "LEFT_BRACKET",
		 ']':    "RIGHT_BRACKET",
		 '{':    "LEFT_CURLY",
		 '}':    "RIGHT_CURLY",
		 '(':    "LEFT_PAREN",
		 ')':    "RIGHT_PAREN"
	 };
	
	// EDIT: created separate opTypeOrder array to indicate the order in which
	//       to evaluate opTypeNames.  (Apparently, SpiderMonkey must iterate
	//       hash keys in the order in which they are defined, an implementation
	//       detail which the original narcissus code relied on.)
	// EDIT: add yielding op
	 var opTypeOrder = [
		 '\n',
		 ';',
		 ',',
		 '?',
		 ':',
		 '||',
		 '&&',
		 '|',
		 '^',
		 '&',
		 '->',
		 '===',
		 '==',
		 '=',
		 '!==',
		 '!=',
		 '<<',
		 '<=',
		 '<',
		 '>>>',
		 '>>',
		 '>=',
		 '>',
		 '++',
		 '--',
		 '+',
		 '-',
		 '*',
		 '/',
		 '%',
		 '!',
		 '~',
		 '.',
		 '[',
		 ']',
		 '{',
		 '}',
		 '(',
		 ')'
	 ];
	 
	 // Hash of keyword identifier to tokens index.  NB: we must null __proto__ to
	 // avoid toString, etc. namespace pollution.
	 var keywords = {__proto__: null};
	 
	 // Define const END, etc., based on the token names.  Also map name to index.
	 // EDIT: use "var " prefix to make definitions local to this function
	 var consts = "var ";
	 for (var i = 0, j = tokens.length; i < j; i++) {
		 if (i > 0)
			 consts += ", ";
		 var t = tokens[i];
		 var name;
		 if (/^[a-z]/.test(t)) {
			 name = t.toUpperCase();
			 keywords[t] = i;
		 } else {
			 name = (/^\W/.test(t) ? opTypeNames[t] : t);
		 }
		 consts += name + " = " + i;
		 this[name] = i;
		 tokens[t] = i;
	 }
	 eval(consts + ";");
	 
	 // Map assignment operators to their indexes in the tokens array.
	 var assignOps = ['|', '^', '&', '<<', '>>', '>>>', '+', '-', '*', '/', '%'];
	 
	 for (i = 0, j = assignOps.length; i < j; i++) {
		 t = assignOps[i];
		 assignOps[t] = tokens[t];
	 }
	 /* vim: set sw=4 ts=8 et tw=80: */
	 /* ***** BEGIN LICENSE BLOCK *****
	  * Version: MPL 1.1/GPL 2.0/LGPL 2.1
	  *
	  * The contents of this file are subject to the Mozilla Public License Version
	  * 1.1 (the "License"); you may not use this file except in compliance with
	  * the License. You may obtain a copy of the License at
	  * http://www.mozilla.org/MPL/
	  *
	  * Software distributed under the License is distributed on an "AS IS" basis,
	  * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
	  * for the specific language governing rights and limitations under the
	  * License.
	  *
	  * The Original Code is the Narcissus JavaScript engine.
	  *
	  * The Initial Developer of the Original Code is
	  * Brendan Eich <brendan@mozilla.org>.
	  * Portions created by the Initial Developer are Copyright (C) 2004
	  * the Initial Developer. All Rights Reserved.
	  *
	  * Contributor(s):
	  *
	  * Alternatively, the contents of this file may be used under the terms of
	  * either the GNU General Public License Version 2 or later (the "GPL"), or
	  * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
	  * in which case the provisions of the GPL or the LGPL are applicable instead
	  * of those above. If you wish to allow use of your version of this file only
	  * under the terms of either the GPL or the LGPL, and not to allow others to
	  * use your version of this file under the terms of the MPL, indicate your
	  * decision by deleting the provisions above and replace them with the notice
	  * and other provisions required by the GPL or the LGPL. If you do not delete
	  * the provisions above, a recipient may use your version of this file under
	  * the terms of any one of the MPL, the GPL or the LGPL.
	  *
	  * ***** END LICENSE BLOCK ***** */
	 
	 /*
	  * Narcissus - JS implemented in JS.
	  *
	  * Lexical scanner and parser.
	  */
	  
	  
	 // Build a regexp that recognizes operators and punctuators (except newline).
	 var opRegExpSrc = "^(?:";
	 
	 // EDIT: change for loop from iterating through opTypeNames keys to using
	 //       opTypeOrder array so that we're not dependent on SpiderMonkey's
	 //       key order default behavior.
	 // EDIT: change regex structure for OOM perf improvement
	 for (var i = 0; i < opTypeOrder.length; i++) {
		 var op = opTypeOrder[i];
		 if (op == '\n')
			 continue;
		 if (opRegExpSrc != "^(?:")
			 opRegExpSrc += "|";
		 
		 // EDIT: expand out this regexp for environments that don't support $&
		 //opRegExpSrc += op.replace(/[?|^&(){}\[\]+\-*\/\.]/g, "\\$&");
		 op = op.replace(/\?/g, "\\?");
		 op = op.replace(/\|/g, "\\|");
		 op = op.replace(/\^/g, "\\^");
		 op = op.replace(/\&/g, "\\&");
		 op = op.replace(/\(/g, "\\(");
		 op = op.replace(/\)/g, "\\)");
		 op = op.replace(/\{/g, "\\{");
		 op = op.replace(/\}/g, "\\}");
		 op = op.replace(/\[/g, "\\[");
		 op = op.replace(/\]/g, "\\]");
		 op = op.replace(/\+/g, "\\+");
		 op = op.replace(/\-/g, "\\-");
		 op = op.replace(/\*/g, "\\*");
		 op = op.replace(/\//g, "\\/");
		 op = op.replace(/\./g, "\\.");
		 opRegExpSrc += op;
	 }
	 opRegExpSrc += ")";
	 var opRegExp = new RegExp(opRegExpSrc);
	 
	 // A regexp to match floating point literals (but not integer literals).
	 // EDIT: change regex structure for OOM perf improvement
	 var fpRegExp = /^(?:\d+\.\d*(?:[eE][-+]?\d+)?|\d+(?:\.\d*)?[eE][-+]?\d+|\.\d+(?:[eE][-+]?\d+)?)/;
	 
	 function Tokenizer(s, f, l) {
		 this.cursor = 0;
		 this.source = String(s);
		 this.tokens = [];
		 this.tokenIndex = 0;
		 this.lookahead = 0;
		 this.scanNewlines = false;
		 this.scanOperand = true;
		 this.filename = f || "";
		 this.lineno = l ? l : 1;
	 }
	  
	 Tokenizer.prototype = {
	 
	 // EDIT: change "input" from a getter to a regular method for compatibility
	 //       with older JavaScript versions
		 input: function() {
			 return this.source.substring(this.cursor);
		 },
	 
	 // EDIT: change "done" from a getter to a regular method for compatibility
	 //       with older JavaScript versions
		 done: function() {
			 return this.peek() == END;
		 },
	 
	 // EDIT: change "token" from a getter to a regular method for compatibility
	 //       with older JavaScript versions
		 token: function() {
			 return this.tokens[this.tokenIndex];
		 },
	 
		 match: function (tt) {
			 return this.get() == tt || this.unget();
		 },
	 
		 mustMatch: function (tt) {
			 if (!this.match(tt)) {
				 throw this.newSyntaxError("Missing " + tokens[tt].toLowerCase());
			 }
			 return this.token();
		 },
	 
		 peek: function () {
			 var tt;
			 if (this.lookahead) {
				 tt = this.tokens[(this.tokenIndex + this.lookahead) & 3].type;
			 } else {
				 tt = this.get();
				 this.unget();
			 }
			 return tt;
		 },
	 
		 peekOnSameLine: function () {
			 this.scanNewlines = true;
			 var tt = this.peek();
			 this.scanNewlines = false;
			 return tt;
		 },
	 
		 get: function () {
			 var token;
			 while (this.lookahead) {
				 --this.lookahead;
				 this.tokenIndex = (this.tokenIndex + 1) & 3;
				 token = this.tokens[this.tokenIndex];
				 if (token.type != NEWLINE || this.scanNewlines)
					 return token.type;
			 }
	 
			 for (;;) {
				 var input = this.input();
				 var firstChar = input.charCodeAt(0);
				 // EDIT: check first char, then use regex
				 // valid regex whitespace includes char codes: 9 10 11 12 13 32
				 if(firstChar == 32 || (firstChar >= 9 && firstChar <= 13)) {
					 var match = input.match(this.scanNewlines ? /^[ \t]+/ : /^\s+/); // EDIT: use x-browser regex syntax
					 if (match) {
						 var spaces = match[0];
						 this.cursor += spaces.length;
						 var newlines = spaces.match(/\n/g);
						 if (newlines)
							 this.lineno += newlines.length;
						 input = this.input();
					}
				 }
	 
				 // EDIT: improve perf by checking first string char before proceeding to regex,
				 //       use x-browser regex syntax
				 if (input.charCodeAt(0) != 47 || !(match = input.match(/^\/(?:\*(?:.|\n)*?\*\/|\/.*)/)))
					 break;
				 var comment = match[0];
				 this.cursor += comment.length;
				 newlines = comment.match(/\n/g);
				 if (newlines)
					 this.lineno += newlines.length
			 }
	 
			 this.tokenIndex = (this.tokenIndex + 1) & 3;
			 token = this.tokens[this.tokenIndex];
			 if (!token)
				 this.tokens[this.tokenIndex] = token = {};
	 
			 if (!input)
				 return token.type = END;
	
			 var firstChar = input.charCodeAt(0);
			 
			 // EDIT: guard by checking char codes before going to regex
			 if ((firstChar == 46 || (firstChar > 47 && firstChar < 58)) && 
				 (match = input.match(fpRegExp))) { // EDIT: use x-browser regex syntax
				 token.type = NUMBER;
				 token.value = parseFloat(match[0]);
			 } else if ((firstChar > 47 && firstChar < 58) && 
						(match = input.match(/^(?:0[xX][\da-fA-F]+|0[0-7]*|\d+)/))) { // EDIT: change regex structure for OOM perf improvement,
																					  //       use x-browser regex syntax
				 token.type = NUMBER;
				 token.value = parseInt(match[0]);
			 } else if (((firstChar > 47 && firstChar < 58)  ||   // EDIT: add guards to check before using regex
						 (firstChar > 64 && firstChar < 91)  || 
						 (firstChar > 96 && firstChar < 123) ||   // EDIT: exclude `
						 (firstChar == 36 || firstChar == 95)) && // EDIT: allow $ + mv _ here
						(match = input.match(/^[$\w]+/))) {       // EDIT: allow $, use x-browser regex syntax
				 var id = match[0];
				 // EDIT: check the type of the value in the keywords hash, as different envs
				 //       expose implicit Object properties that SpiderMonkey does not.
				 token.type = typeof(keywords[id]) == "number" ? keywords[id] : IDENTIFIER;
				 token.value = id;
			 } else if ((firstChar == 34 || firstChar == 39) && 
						(match = input.match(/^(?:"(?:\\.|[^"])*"|'(?:[^']|\\.)*')/))) { //"){  // EDIT: change regex structure for OOM perf improvement,
																								//       use x-browser regex syntax
				 token.type = STRING;
				 token.value = eval(match[0]);
			 } else if (this.scanOperand && firstChar == 47 && // EDIT: improve perf by guarding with first char check
						(match = input.match(/^\/((?:\\.|[^\/])+)\/([gi]*)/))) { // EDIT: use x-browser regex syntax
				 token.type = REGEXP;
				 token.value = new RegExp(match[1], match[2]);
			 } else if ((match = input.match(opRegExp))) { // EDIT: use x-browser regex syntax
				 var op = match[0];
				 // EDIT: IE doesn't support indexing of strings -- use charAt
				 if (assignOps[op] && input.charAt(op.length) == '=') {
					 token.type = ASSIGN;
					 token.assignOp = eval(opTypeNames[op]);
					 match[0] += '=';
				 } else {
					 token.type = eval(opTypeNames[op]);
					 if (this.scanOperand &&
						 (token.type == PLUS || token.type == MINUS)) {
						 token.type += UNARY_PLUS - PLUS;
					 }
					 token.assignOp = null;
				 }
				 token.value = op;
			 } else {
				 throw this.newSyntaxError("Illegal token");
			 }
	
			 token.start = this.cursor;
			 this.cursor += match[0].length;
			 token.end = this.cursor;
			 token.lineno = this.lineno;
			 return token.type;
		 },
	 
		 unget: function () {
			 if (++this.lookahead == 4) throw "PANIC: too much lookahead!";
			 this.tokenIndex = (this.tokenIndex - 1) & 3;
		 },
	 
		 newSyntaxError: function (m) {
			 var e = new SyntaxError(m, this.filename, this.lineno);
			 e.lineNumber = this.lineno; // EDIT: x-browser exception handling
			 e.source = this.source;
			 e.cursor = this.cursor;
			 return e;
		 }
	 };
	 
	 function CompilerContext(inFunction) {
		 this.inFunction = inFunction;
		 this.stmtStack = [];
		 this.funDecls = [];
		 this.varDecls = [];
	 }
	 
	 var CCp = CompilerContext.prototype;
	 CCp.bracketLevel = CCp.curlyLevel = CCp.parenLevel = CCp.hookLevel = 0;
	 CCp.ecmaStrictMode = CCp.inForLoopInit = false;
	 
	 function Script(t, x) {
		 var n = Statements(t, x);
		 n.type = SCRIPT;
		 n.funDecls = x.funDecls;
		 n.varDecls = x.varDecls;
		 return n;
	 }
	 
	// EDIT: change "top" method to be a regular method, rather than defined
	//       via the SpiderMonkey-specific __defineProperty__
	
	 // Node extends Array, which we extend slightly with a top-of-stack method.
	 Array.prototype.top = function() {
		return this.length && this[this.length-1];
	 }
	 
	 function Node(t, type) {
		 // EDIT: "inherit" from Array in an x-browser way.
		 var _this = [];
		 for (var n in Node.prototype)
		 	_this[n] = Node.prototype[n];

		 _this.constructor = Node;

		 var token = t.token();
		 if (token) {
			 _this.type = type || token.type;
			 _this.value = token.value;
			 _this.lineno = token.lineno;
			 _this.start = token.start;
			 _this.end = token.end;
		 } else {
			 _this.type = type;
			 _this.lineno = t.lineno;
		 }
		 _this.tokenizer = t;
	 
		 for (var i = 2; i < arguments.length; i++) 
			_this.push(arguments[i]);
		
		 return _this;
	 }
	 
	 var Np = Node.prototype; // EDIT: don't inherit from array
	 Np.toSource = Object.prototype.toSource;
	 	
	 // Always use push to add operands to an expression, to update start and end.
	 Np.push = function (kid) {
		 if (kid.start < this.start)
			 this.start = kid.start;
		 if (this.end < kid.end)
			 this.end = kid.end;
	
		 this[this.length] = kid;
	 }
	 
	 Node.indentLevel = 0;
	 
	 Np.toString = function () {
		 var a = [];
		 for (var i in this) {
			 if (this.hasOwnProperty(i) && i != 'type' && i != 'parent' && typeof(this[i]) != 'function') {
				 // EDIT,BUG: add check for 'target' to prevent infinite recursion
				 if(i != 'target')
					 a.push({id: i, value: this[i]});
				 else
					 a.push({id: i, value: "[token: " + this[i].value + "]"});
			 }
					
		 }
		 a.sort(function (a,b) { return (a.id < b.id) ? -1 : 1; });
		 INDENTATION = "    ";
		 var n = ++Node.indentLevel;
		 var t = tokens[this.type];
		 var s = "{\n" + INDENTATION.repeat(n) +
				 "type: " + (/^\W/.test(t) ? opTypeNames[t] : t.toUpperCase());
		 for (i = 0; i < a.length; i++) {
			 s += ",\n" + INDENTATION.repeat(n) + a[i].id + ": " + a[i].value;}
		 n = --Node.indentLevel;
		 s += "\n" + INDENTATION.repeat(n) + "}";
		 return s;
	 }
	 
	 Np.getSource = function () {
		 return this.tokenizer.source.slice(this.start, this.end);
	 };
	 
	// EDIT: change "filename" method to be a regular method, rather than defined
	//       via the SpiderMonkey-specific __defineGetter__
	 Np.filename = function () { return this.tokenizer.filename; };
	 
	 String.prototype.repeat = function (n) {
		 var s = "", t = this + s;
		 while (--n >= 0)
			 s += t;
		 return s;
	 }
	 
	 // Statement stack and nested statement handler.
	 function nest(t, x, node, func, end) {
		 x.stmtStack.push(node);
		 var n = func(t, x);
		 x.stmtStack.pop();
		 end && t.mustMatch(end);
		 return n;
	 }
	 
	 function Statements(t, x) {
		 var n = Node(t, BLOCK);
		 x.stmtStack.push(n);
		 while (!t.done() && t.peek() != RIGHT_CURLY) 
			 n.push(Statement(t, x));
		 x.stmtStack.pop();
		 return n;
	 }
	 
	 function Block(t, x) {
		t.mustMatch(LEFT_CURLY);
		 var n = Statements(t, x);
		 t.mustMatch(RIGHT_CURLY);
		 return n;
	 }
	 
	 var DECLARED_FORM = 0, EXPRESSED_FORM = 1, STATEMENT_FORM = 2;
	 
	 function Statement(t, x) {
		 var i, label, n, n2, ss, tt = t.get();
	 
		 // Cases for statements ending in a right curly return early, avoiding the
		 // common semicolon insertion magic after this switch.
		switch (tt) {
		   case FUNCTION:
			 return FunctionDefinition(t, x, true,
									   (x.stmtStack.length > 1)
									   ? STATEMENT_FORM
									   : DECLARED_FORM);
	 
		   case LEFT_CURLY:
			 n = Statements(t, x);
			 t.mustMatch(RIGHT_CURLY);
			 return n;
	 
		   case IF:
			 n = Node(t);
			 n.condition = ParenExpression(t, x);
			 x.stmtStack.push(n);
			 n.thenPart = Statement(t, x);
			 n.elsePart = t.match(ELSE) ? Statement(t, x) : null;
			 x.stmtStack.pop();
			 return n;
	 
		   case SWITCH:
			 n = Node(t);
			 t.mustMatch(LEFT_PAREN);
			 n.discriminant = Expression(t, x);
			 t.mustMatch(RIGHT_PAREN);
			 n.cases = [];
			 n.defaultIndex = -1;
			 x.stmtStack.push(n);
			 t.mustMatch(LEFT_CURLY);
			 while ((tt = t.get()) != RIGHT_CURLY) {
				 switch (tt) {
				   case DEFAULT:
					 if (n.defaultIndex >= 0)
						 throw t.newSyntaxError("More than one switch default");
					 // FALL THROUGH
				   case CASE:
					 n2 = Node(t);
					 if (tt == DEFAULT)
						 n.defaultIndex = n.cases.length;
					 else
						 n2.caseLabel = Expression(t, x, COLON);
					 break;
				   default:
					 throw t.newSyntaxError("Invalid switch case");
				 }
				 t.mustMatch(COLON);
				 n2.statements = Node(t, BLOCK);
				 while ((tt=t.peek()) != CASE && tt != DEFAULT && tt != RIGHT_CURLY)
					 n2.statements.push(Statement(t, x));
				 n.cases.push(n2);
			 }
			 x.stmtStack.pop();
			 return n;
	 
		   case FOR:
			 n = Node(t);
			 n.isLoop = true;
			 t.mustMatch(LEFT_PAREN);
			 if ((tt = t.peek()) != SEMICOLON) {
				 x.inForLoopInit = true;
				 if (tt == VAR || tt == CONST) {
					 t.get();
					 n2 = Variables(t, x);
				 } else {
					 n2 = Expression(t, x);
				 }
				 x.inForLoopInit = false;
			 }
			 if (n2 && t.match(IN)) {
				 n.type = FOR_IN;
				 if (n2.type == VAR) {
					 if (n2.length != 1) {
						 throw new SyntaxError("Invalid for..in left-hand side",
											   t.filename, n2.lineno);
					 }
	 
					 // NB: n2[0].type == IDENTIFIER and n2[0].value == n2[0].name.
					 n.iterator = n2[0];
					 n.varDecl = n2;
				 } else {
					 n.iterator = n2;
					 n.varDecl = null;
				 }
				 n.object = Expression(t, x);
			 } else {
				 n.setup = n2 || null;
				 t.mustMatch(SEMICOLON);
				 n.condition = (t.peek() == SEMICOLON) ? null : Expression(t, x);
				 t.mustMatch(SEMICOLON);
				 n.update = (t.peek() == RIGHT_PAREN) ? null : Expression(t, x);
			 }
			 t.mustMatch(RIGHT_PAREN);
			 n.body = nest(t, x, n, Statement);
			 return n;
	 
		   case WHILE:
			 n = Node(t);
			 n.isLoop = true;
			 n.condition = ParenExpression(t, x);
			 n.body = nest(t, x, n, Statement);
			 return n;
	 
		   case DO:
			 n = Node(t);
			 n.isLoop = true;
			 n.body = nest(t, x, n, Statement, WHILE);
			 n.condition = ParenExpression(t, x);
			 if (!x.ecmaStrictMode) {
				 // <script language="JavaScript"> (without version hints) may need
				 // automatic semicolon insertion without a newline after do-while.
				 // See http://bugzilla.mozilla.org/show_bug.cgi?id=238945.
				 t.match(SEMICOLON);
				 return n;
			 }
			 break;
	 
		   case BREAK:
		   case CONTINUE:
			 n = Node(t);
			 if (t.peekOnSameLine() == IDENTIFIER) {
				 t.get();
				 n.label = t.token().value;
			 }
			 ss = x.stmtStack;
			 i = ss.length;
			 label = n.label;
			 if (label) {
				 do {
					 if (--i < 0)
						 throw t.newSyntaxError("Label not found");
				 } while (ss[i].label != label);
			 } else {
				 do {
					 if (--i < 0) {
						 throw t.newSyntaxError("Invalid " + ((tt == BREAK)
															  ? "break"
															  : "continue"));
					 }
				 } while (!ss[i].isLoop && (tt != BREAK || ss[i].type != SWITCH));
			 }
			 n.target = ss[i];
			 break;
	 
		   case TRY:
			 n = Node(t);
			 n.tryBlock = Block(t, x);
			 n.catchClauses = [];
			 while (t.match(CATCH)) {
				 n2 = Node(t);
				 t.mustMatch(LEFT_PAREN);
				 n2.varName = t.mustMatch(IDENTIFIER).value;
				 if (t.match(IF)) {
					 if (x.ecmaStrictMode)
						 throw t.newSyntaxError("Illegal catch guard");
					 if (n.catchClauses.length && !n.catchClauses.top().guard)
						 throw t.newSyntaxError("Guarded catch after unguarded");
					 n2.guard = Expression(t, x);
				 } else {
					 n2.guard = null;
				 }
				 t.mustMatch(RIGHT_PAREN);
				 n2.block = Block(t, x);
				 n.catchClauses.push(n2);
			 }
			 if (t.match(FINALLY))
				 n.finallyBlock = Block(t, x);
			 if (!n.catchClauses.length && !n.finallyBlock)
				 throw t.newSyntaxError("Invalid try statement");
			 return n;
	 
		   case CATCH:
		   case FINALLY:
			 throw t.newSyntaxError(tokens[tt] + " without preceding try");
	 
		   case THROW:
			 n = Node(t);
			 n.exception = Expression(t, x);
			 break;
	 
		   case RETURN:
			 if (!x.inFunction)
				 throw t.newSyntaxError("Invalid return");
			 n = Node(t);
			 tt = t.peekOnSameLine();
			 // EDIT,BUG?: rather that set n.value (which already has meaning for
			 //            nodes), set n.expression
			 if (tt != END && tt != NEWLINE && tt != SEMICOLON && tt != RIGHT_CURLY)
				 n.expression = Expression(t, x);
			 break;
	 
		   case WITH:
			 n = Node(t);
			 n.object = ParenExpression(t, x);
			 n.body = nest(t, x, n, Statement);
			 return n;
	 
		   case VAR:
		   case CONST:
			 n = Variables(t, x);
			 break;
	 
		   case DEBUGGER:
			 n = Node(t);
			 break;
	 
		   case NEWLINE:
		   case SEMICOLON:
			 n = Node(t, SEMICOLON);
			 n.expression = null;
			 return n;
	 
		   default:
			 if (tt == IDENTIFIER && t.peek() == COLON) {
				 label = t.token().value;
				 ss = x.stmtStack;
				 for (i = ss.length-1; i >= 0; --i) {
					 if (ss[i].label == label)
						 throw t.newSyntaxError("Duplicate label");
				 }
				 t.get();
				 n = Node(t, LABEL);
				 n.label = label;
				 n.statement = nest(t, x, n, Statement);
				 return n;
			 }
	 
			 n = Node(t, SEMICOLON);
			 t.unget();
			 n.expression = Expression(t, x);
			 n.end = n.expression.end;
			 break;
		 }
	 
		 if (t.lineno == t.token().lineno) {
			 tt = t.peekOnSameLine();
			 if (tt != END && tt != NEWLINE && tt != SEMICOLON && tt != RIGHT_CURLY)
				 throw t.newSyntaxError("Missing ; before statement " + tokens[tt]);
		 }
		 t.match(SEMICOLON);
		 return n;
	 }
	 
	 function FunctionDefinition(t, x, requireName, functionForm) {
		 var f = Node(t);
		 if (f.type != FUNCTION)
			 f.type = (f.value == "get") ? GETTER : SETTER;
		 if (t.match(IDENTIFIER))
			 f.name = t.token().value;
		 else if (requireName)
			 throw t.newSyntaxError("Missing function identifier");
	
		 t.mustMatch(LEFT_PAREN);
		 f.params = [];
		 var tt;
		 while ((tt = t.get()) != RIGHT_PAREN) {
			 if (tt != IDENTIFIER)
				 throw t.newSyntaxError("Missing formal parameter");
			 f.params.push(t.token().value);
			 if (t.peek() != RIGHT_PAREN)
				 t.mustMatch(COMMA);
		 }
	 
		 t.mustMatch(LEFT_CURLY);
		 var x2 = new CompilerContext(true);
		 f.body = Script(t, x2);
		 t.mustMatch(RIGHT_CURLY);
		 f.end = t.token().end;
	 
		 f.functionForm = functionForm;
		 if (functionForm == DECLARED_FORM)
			 x.funDecls.push(f);
		 return f;
	 }
	 
	 function Variables(t, x) {
		 var n = Node(t);
		 do {
			 t.mustMatch(IDENTIFIER);
			 var n2 = Node(t);
			 n2.name = n2.value;
			 if (t.match(ASSIGN)) {
				 if (t.token().assignOp)
					 throw t.newSyntaxError("Invalid variable initialization");
				 n2.initializer = Expression(t, x, COMMA);
			 }
			 n2.readOnly = (n.type == CONST);
			 n.push(n2);
			 x.varDecls.push(n2);
		 } while (t.match(COMMA));
		 return n;
	 }
	 
	 function ParenExpression(t, x) {
		 t.mustMatch(LEFT_PAREN);
		 var n = Expression(t, x);
		 t.mustMatch(RIGHT_PAREN);
		 return n;
	 }
	 
	 // EDIT: add yielding op precedence
	 var opPrecedence = {
		 SEMICOLON: 0,
		 COMMA: 1,
		 ASSIGN: 2,
		 HOOK: 3, COLON: 3, CONDITIONAL: 3,
		 OR: 4,
		 AND: 5,
		 BITWISE_OR: 6,
		 BITWISE_XOR: 7,
		 BITWISE_AND: 8,
		 EQ: 9, NE: 9, STRICT_EQ: 9, STRICT_NE: 9,
		 LT: 10, LE: 10, GE: 10, GT: 10, IN: 10, INSTANCEOF: 10,
		 LSH: 11, RSH: 11, URSH: 11,
		 PLUS: 12, MINUS: 12,
		 MUL: 13, DIV: 13, MOD: 13,
		 DELETE: 14, VOID: 14, TYPEOF: 14, // PRE_INCREMENT: 14, PRE_DECREMENT: 14,
		 NOT: 14, BITWISE_NOT: 14, UNARY_PLUS: 14, UNARY_MINUS: 14,
		 INCREMENT: 15, DECREMENT: 15,     // postfix
		 NEW: 16,
		 YIELDING: 17,
		 DOT: 18
	 };
	 
	 // Map operator type code to precedence.
	 // EDIT: slurp opPrecence items into array first, because IE includes
	 //       modified hash items in iterator when modified during iteration
	 var opPrecedenceItems = [];
	 for (i in opPrecedence) 
		opPrecedenceItems.push(i);
	 
	 for (var i = 0; i < opPrecedenceItems.length; i++) {
		var item = opPrecedenceItems[i];
		opPrecedence[eval(item)] = opPrecedence[item];
	 }
	
	 var opArity = {
		 COMMA: -2,
		 ASSIGN: 2,
		 CONDITIONAL: 3,
		 OR: 2,
		 AND: 2,
		 BITWISE_OR: 2,
		 BITWISE_XOR: 2,
		 BITWISE_AND: 2,
		 EQ: 2, NE: 2, STRICT_EQ: 2, STRICT_NE: 2,
		 LT: 2, LE: 2, GE: 2, GT: 2, IN: 2, INSTANCEOF: 2,
		 LSH: 2, RSH: 2, URSH: 2,
		 PLUS: 2, MINUS: 2,
		 MUL: 2, DIV: 2, MOD: 2,
		 DELETE: 1, VOID: 1, TYPEOF: 1,  // PRE_INCREMENT: 1, PRE_DECREMENT: 1,
		 NOT: 1, BITWISE_NOT: 1, UNARY_PLUS: 1, UNARY_MINUS: 1,
		 INCREMENT: 1, DECREMENT: 1,     // postfix
		 NEW: 1, NEW_WITH_ARGS: 2, DOT: 2, INDEX: 2, CALL: 2, YIELDING: 3,
		 ARRAY_INIT: 1, OBJECT_INIT: 1, GROUP: 1
	 };
	 
	 // Map operator type code to arity.
	 // EDIT: same as above
	 var opArityItems = [];
	 for (i in opArity)
		opArityItems.push(i);
	 
	 for (var i = 0; i < opArityItems.length; i++) {
		var item = opArityItems[i];
		opArity[eval(item)] = opArity[item];
	 }
	 
	 function Expression(t, x, stop) {
		 var n, id, tt, operators = [], operands = [];
		 var bl = x.bracketLevel, cl = x.curlyLevel, pl = x.parenLevel,
			 hl = x.hookLevel;
	 
		 function reduce() {
			 var n = operators.pop();
			 var op = n.type;
			 var arity = opArity[op];
			 if (arity == -2) {
				 // Flatten left-associative trees.
				 var left = operands.length >= 2 && operands[operands.length-2];
				 if (left.type == op) {
					 var right = operands.pop();
					 left.push(right);
					 return left;
				 }
				 arity = 2;
			 }
	 
			 // Always use push to add operands to n, to update start and end.
			 // EDIT: provide second argument to splice or IE won't work.
			 var index = operands.length - arity;
			 var a = operands.splice(index, operands.length - index);
			 for (var i = 0; i < arity; i++)
				 n.push(a[i]);
	 
			 // Include closing bracket or postfix operator in [start,end).
			 if (n.end < t.token().end)
				 n.end = t.token().end;

			 operands.push(n);
			 return n;
		 }
	 
	 loop:
		 while ((tt = t.get()) != END) {
			 if (tt == stop &&
				 x.bracketLevel == bl && x.curlyLevel == cl && x.parenLevel == pl &&
				 x.hookLevel == hl) {
				 // Stop only if tt matches the optional stop parameter, and that
				 // token is not quoted by some kind of bracket.
				 break;
			 }
			 switch (tt) {
			   case SEMICOLON:
				 // NB: cannot be empty, Statement handled that.
				 break loop;
	 
			   case ASSIGN:
			   case HOOK:
			   case COLON:
				 if (t.scanOperand)
					 break loop;
				 // Use >, not >=, for right-associative ASSIGN and HOOK/COLON.
				 while (opPrecedence[operators.top().type] > opPrecedence[tt])
					 reduce();
				 if (tt == COLON) {
					 n = operators.top();
					 if (n.type != HOOK)
						 throw t.newSyntaxError("Invalid label");
					 n.type = CONDITIONAL;
					 --x.hookLevel;
				 } else {
					 operators.push(Node(t));
					 if (tt == ASSIGN)
						 operands.top().assignOp = t.token().assignOp;
					 else
						 ++x.hookLevel;      // tt == HOOK
				 }
				 t.scanOperand = true;
				 break;
	 
			   case IN:
				 // An in operator should not be parsed if we're parsing the head of
				 // a for (...) loop, unless it is in the then part of a conditional
				 // expression, or parenthesized somehow.
				 if (x.inForLoopInit && !x.hookLevel &&
					 !x.bracketLevel && !x.curlyLevel && !x.parenLevel) {
					 break loop;
				 }
				 // FALL THROUGH
			   case COMMA:
				 // Treat comma as left-associative so reduce can fold left-heavy
				 // COMMA trees into a single array.
				 // FALL THROUGH
			   case OR:
			   case AND:
			   case BITWISE_OR:
			   case BITWISE_XOR:
			   case BITWISE_AND:
			   case EQ: case NE: case STRICT_EQ: case STRICT_NE:
			   case LT: case LE: case GE: case GT:
			   case INSTANCEOF:
			   case LSH: case RSH: case URSH:
			   case PLUS: case MINUS:
			   case MUL: case DIV: case MOD:
			   case DOT:
				 if (t.scanOperand)
					 break loop;
				 while (opPrecedence[operators.top().type] >= opPrecedence[tt])
					 reduce();
				 if (tt == DOT) {
					 t.mustMatch(IDENTIFIER);
					 operands.push(Node(t, DOT, operands.pop(), Node(t)));
				 } else {
					 operators.push(Node(t));
					 t.scanOperand = true;
				 }
				 break;
	 
			   case DELETE: case VOID: case TYPEOF:
			   case NOT: case BITWISE_NOT: case UNARY_PLUS: case UNARY_MINUS:
			   case NEW:
				 if (!t.scanOperand)
					 break loop;
				 operators.push(Node(t));
				 break;
	 
			   case INCREMENT: case DECREMENT:
				 if (t.scanOperand) {
					 operators.push(Node(t));  // prefix increment or decrement
				 } else {
					 // Use >, not >=, so postfix has higher precedence than prefix.
					 while (opPrecedence[operators.top().type] > opPrecedence[tt])
						 reduce();
					 n = Node(t, tt, operands.pop());
					 n.postfix = true;
					 operands.push(n);
				 }
				 break;
	 
			   case FUNCTION:
				 if (!t.scanOperand)
					 break loop;
				 operands.push(FunctionDefinition(t, x, false, EXPRESSED_FORM));
				 t.scanOperand = false;
				 break;
	 
			   case NULL: case THIS: case TRUE: case FALSE:
			   case IDENTIFIER: case NUMBER: case STRING: case REGEXP:
				 if (!t.scanOperand)
					 break loop;
				 operands.push(Node(t));
				 t.scanOperand = false;
				 break;
	 
			   case LEFT_BRACKET:
				 if (t.scanOperand) {
					 // Array initialiser.  Parse using recursive descent, as the
					 // sub-grammar here is not an operator grammar.
					 n = Node(t, ARRAY_INIT);
					 while ((tt = t.peek()) != RIGHT_BRACKET) {
						 if (tt == COMMA) {
							 t.get();
							 n.push(null);
							 continue;
						 }
						 n.push(Expression(t, x, COMMA));
						 if (!t.match(COMMA))
							 break;
					 }
					 t.mustMatch(RIGHT_BRACKET);
					 operands.push(n);
					 t.scanOperand = false;
				 } else {
					 // Property indexing operator.
					 operators.push(Node(t, INDEX));
					 t.scanOperand = true;
					 ++x.bracketLevel;
				 }
				 break;
	 
			   case RIGHT_BRACKET:
				 if (t.scanOperand || x.bracketLevel == bl)
					 break loop;
				 while (reduce().type != INDEX)
					 continue;
				 --x.bracketLevel;
				 break;
	 
			   case LEFT_CURLY:
				 if (!t.scanOperand)
					 break loop;
				 // Object initialiser.  As for array initialisers (see above),
				 // parse using recursive descent.
				 ++x.curlyLevel;
				 n = Node(t, OBJECT_INIT);
			   object_init:
				 if (!t.match(RIGHT_CURLY)) {
					 do {
						 tt = t.get();
						 if ((t.token().value == "get" || t.token().value == "set") &&
							 t.peek() == IDENTIFIER) {
							 if (x.ecmaStrictMode)
								 throw t.newSyntaxError("Illegal property accessor");
							 n.push(FunctionDefinition(t, x, true, EXPRESSED_FORM));
						 } else {
							 switch (tt) {
							   case IDENTIFIER:
							   case NUMBER:
							   case STRING:
								 id = Node(t);
								 break;
							   case RIGHT_CURLY:
								 if (x.ecmaStrictMode)
									 throw t.newSyntaxError("Illegal trailing ,");
								 break object_init;
							   default:
								 throw t.newSyntaxError("Invalid property name");
							 }
							 t.mustMatch(COLON);
							 n.push(Node(t, PROPERTY_INIT, id,
											 Expression(t, x, COMMA)));
						 }
					 } while (t.match(COMMA));
					 t.mustMatch(RIGHT_CURLY);
				 }
				 operands.push(n);
				 t.scanOperand = false;
				 --x.curlyLevel;
				 break;
	 
			   case RIGHT_CURLY:
				 if (!t.scanOperand && x.curlyLevel != cl)
					 throw "PANIC: right curly botch";
				 break loop;
	 
			   case YIELDING:
				 while (opPrecedence[operators.top().type] > opPrecedence[YIELDING])
					 reduce();
				 t.mustMatch(LEFT_PAREN);
				 var yielding = true;
				 // FALL THROUGH
				 
			   case LEFT_PAREN:
				 if (t.scanOperand) {
					 operators.push(Node(t, GROUP));
				 } else {
					 while (opPrecedence[operators.top().type] > opPrecedence[NEW])
						 reduce();
	 
					 // Handle () now, to regularize the n-ary case for n > 0.
					 // We must set scanOperand in case there are arguments and
					 // the first one is a regexp or unary+/-.
					 n = operators.top();
					 t.scanOperand = true;
					 if (t.match(RIGHT_PAREN)) {
						 if (n.type == NEW) {
							 --operators.length;
							 n.push(operands.pop());
						 } else {
							 n = Node(t, CALL, operands.pop(),
										  Node(t, LIST));
						 }
						 operands.push(n);
						 t.scanOperand = false;
						 n.yieldOp = yielding || false;
						 break;
					 }
					 if (n.type == NEW) {
						 n.type = NEW_WITH_ARGS;
					 } else {
						 n = Node(t, CALL);
						 operators.push(n);
					 }
					 n.yieldOp = yielding || false;
				 }
				 ++x.parenLevel;
				 break;
	 
			   case RIGHT_PAREN:
				 if (t.scanOperand || x.parenLevel == pl)
					 break loop;
				 while ((tt = reduce().type) != GROUP && tt != CALL &&
						tt != NEW_WITH_ARGS) {
					 continue;
				 }
				 if (tt != GROUP) {
					 n = operands.top();
					 if (n[1].type != COMMA)
						 n[1] = Node(t, LIST, n[1]);
					 else
						 n[1].type = LIST;
				 }
				 --x.parenLevel;
				 break;
	 
			   // Automatic semicolon insertion means we may scan across a newline
			   // and into the beginning of another statement.  If so, break out of
			   // the while loop and let the t.scanOperand logic handle errors.
			   default:
				 break loop;
			 }
		 }
	 
		 if (x.hookLevel != hl)
			 throw t.newSyntaxError("Missing : after ?");
		 if (t.scanOperand)
			 throw t.newSyntaxError("Missing operand");
	 
		 // Resume default mode, scanning for operands, not operators.
		 t.scanOperand = true;
		 t.unget();
		 while (operators.length)
			 reduce();
		 return operands.pop();
	 }
	 
	 function parse(s, f, l) {
		 var t = new Tokenizer(s, f, l);
		 var x = new CompilerContext(false);
		 var n = Script(t, x);
		 if (!t.done())
			 throw t.newSyntaxError("Syntax error");
		 return n;
	 }
	 
	 // make stuff visible to NjsCompiler
	 this.parse      = parse;
	 this.Node       = Node;
	 this.tokens     = tokens;
	 this.consts     = consts;
	 
}).call(Narcissus);

(function () {
    "use strict";

    var parse = (function () {

        /***********************************************************************

          A JavaScript tokenizer / parser / beautifier / compressor.

          This version is suitable for Node.js.  With minimal changes (the
          exports stuff) it should work on any JS platform.

          This file contains the tokenizer/parser.  It is a port to JavaScript
          of parse-js [1], a JavaScript parser library written in Common Lisp
          by Marijn Haverbeke.  Thank you Marijn!

          [1] http://marijn.haverbeke.nl/parse-js/

          Exported functions:

            - tokenizer(code) -- returns a function.  Call the returned
              function to fetch the next token.

            - parse(code) -- returns an AST of the given JavaScript code.

          -------------------------------- (C) ---------------------------------

                                   Author: Mihai Bazon
                                 <mihai.bazon@gmail.com>
                               http://mihai.bazon.net/blog

          Distributed under the BSD license:

            Copyright 2010 (c) Mihai Bazon <mihai.bazon@gmail.com>
            Based on parse-js (http://marijn.haverbeke.nl/parse-js/).

            Redistribution and use in source and binary forms, with or without
            modification, are permitted provided that the following conditions
            are met:

                * Redistributions of source code must retain the above
                  copyright notice, this list of conditions and the following
                  disclaimer.

                * Redistributions in binary form must reproduce the above
                  copyright notice, this list of conditions and the following
                  disclaimer in the documentation and/or other materials
                  provided with the distribution.

            THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER "AS IS" AND ANY
            EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
            IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
            PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE
            LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
            OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
            PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
            PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
            THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
            TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF
            THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF
            SUCH DAMAGE.

         ***********************************************************************/

        /* -----[ Tokenizer (constants) ]----- */

        var KEYWORDS = array_to_hash([
                "break",
                "case",
                "catch",
                "const",
                "continue",
                "default",
                "delete",
                "do",
                "else",
                "finally",
                "for",
                "function",
                "if",
                "in",
                "instanceof",
                "new",
                "return",
                "switch",
                "throw",
                "try",
                "typeof",
                "var",
                "void",
                "while",
                "with"
        ]);

        var RESERVED_WORDS = array_to_hash([
                "abstract",
                "boolean",
                "byte",
                "char",
                "class",
                "debugger",
                "double",
                "enum",
                "export",
                "extends",
                "final",
                "float",
                "goto",
                "implements",
                "import",
                "int",
                "interface",
                "long",
                "native",
                "package",
                "private",
                "protected",
                "public",
                "short",
                "static",
                "super",
                "synchronized",
                "throws",
                "transient",
                "volatile"
        ]);

        var KEYWORDS_BEFORE_EXPRESSION = array_to_hash([
                "return",
                "new",
                "delete",
                "throw",
                "else",
                "case"
        ]);

        var KEYWORDS_ATOM = array_to_hash([
                "false",
                "null",
                "true",
                "undefined"
        ]);

        var OPERATOR_CHARS = array_to_hash(characters("+-*&%=<>!?|~^"));

        var RE_HEX_NUMBER = /^0x[0-9a-f]+$/i;
        var RE_OCT_NUMBER = /^0[0-7]+$/;
        var RE_DEC_NUMBER = /^\d*\.?\d*(?:e[+-]?\d*(?:\d\.?|\.?\d)\d*)?$/i;

        var OPERATORS = array_to_hash([
                "in",
                "instanceof",
                "typeof",
                "new",
                "void",
                "delete",
                "++",
                "--",
                "+",
                "-",
                "!",
                "~",
                "&",
                "|",
                "^",
                "*",
                "/",
                "%",
                ">>",
                "<<",
                ">>>",
                "<",
                ">",
                "<=",
                ">=",
                "==",
                "===",
                "!=",
                "!==",
                "?",
                "=",
                "+=",
                "-=",
                "/=",
                "*=",
                "%=",
                ">>=",
                "<<=",
                ">>>=",
                "|=",
                "^=",
                "&=",
                "&&",
                "||"
        ]);

        var WHITESPACE_CHARS = array_to_hash(characters(" \n\r\t\u200b"));

        var PUNC_BEFORE_EXPRESSION = array_to_hash(characters("[{}(,.;:"));

        var PUNC_CHARS = array_to_hash(characters("[]{}(),;:"));

        var REGEXP_MODIFIERS = array_to_hash(characters("gmsiy"));

        /* -----[ Tokenizer ]----- */

        // regexps adapted from http://xregexp.com/plugins/#unicode
        var UNICODE = {
                letter: new RegExp("[\\u0041-\\u005A\\u0061-\\u007A\\u00AA\\u00B5\\u00BA\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02C1\\u02C6-\\u02D1\\u02E0-\\u02E4\\u02EC\\u02EE\\u0370-\\u0374\\u0376\\u0377\\u037A-\\u037D\\u0386\\u0388-\\u038A\\u038C\\u038E-\\u03A1\\u03A3-\\u03F5\\u03F7-\\u0481\\u048A-\\u0523\\u0531-\\u0556\\u0559\\u0561-\\u0587\\u05D0-\\u05EA\\u05F0-\\u05F2\\u0621-\\u064A\\u066E\\u066F\\u0671-\\u06D3\\u06D5\\u06E5\\u06E6\\u06EE\\u06EF\\u06FA-\\u06FC\\u06FF\\u0710\\u0712-\\u072F\\u074D-\\u07A5\\u07B1\\u07CA-\\u07EA\\u07F4\\u07F5\\u07FA\\u0904-\\u0939\\u093D\\u0950\\u0958-\\u0961\\u0971\\u0972\\u097B-\\u097F\\u0985-\\u098C\\u098F\\u0990\\u0993-\\u09A8\\u09AA-\\u09B0\\u09B2\\u09B6-\\u09B9\\u09BD\\u09CE\\u09DC\\u09DD\\u09DF-\\u09E1\\u09F0\\u09F1\\u0A05-\\u0A0A\\u0A0F\\u0A10\\u0A13-\\u0A28\\u0A2A-\\u0A30\\u0A32\\u0A33\\u0A35\\u0A36\\u0A38\\u0A39\\u0A59-\\u0A5C\\u0A5E\\u0A72-\\u0A74\\u0A85-\\u0A8D\\u0A8F-\\u0A91\\u0A93-\\u0AA8\\u0AAA-\\u0AB0\\u0AB2\\u0AB3\\u0AB5-\\u0AB9\\u0ABD\\u0AD0\\u0AE0\\u0AE1\\u0B05-\\u0B0C\\u0B0F\\u0B10\\u0B13-\\u0B28\\u0B2A-\\u0B30\\u0B32\\u0B33\\u0B35-\\u0B39\\u0B3D\\u0B5C\\u0B5D\\u0B5F-\\u0B61\\u0B71\\u0B83\\u0B85-\\u0B8A\\u0B8E-\\u0B90\\u0B92-\\u0B95\\u0B99\\u0B9A\\u0B9C\\u0B9E\\u0B9F\\u0BA3\\u0BA4\\u0BA8-\\u0BAA\\u0BAE-\\u0BB9\\u0BD0\\u0C05-\\u0C0C\\u0C0E-\\u0C10\\u0C12-\\u0C28\\u0C2A-\\u0C33\\u0C35-\\u0C39\\u0C3D\\u0C58\\u0C59\\u0C60\\u0C61\\u0C85-\\u0C8C\\u0C8E-\\u0C90\\u0C92-\\u0CA8\\u0CAA-\\u0CB3\\u0CB5-\\u0CB9\\u0CBD\\u0CDE\\u0CE0\\u0CE1\\u0D05-\\u0D0C\\u0D0E-\\u0D10\\u0D12-\\u0D28\\u0D2A-\\u0D39\\u0D3D\\u0D60\\u0D61\\u0D7A-\\u0D7F\\u0D85-\\u0D96\\u0D9A-\\u0DB1\\u0DB3-\\u0DBB\\u0DBD\\u0DC0-\\u0DC6\\u0E01-\\u0E30\\u0E32\\u0E33\\u0E40-\\u0E46\\u0E81\\u0E82\\u0E84\\u0E87\\u0E88\\u0E8A\\u0E8D\\u0E94-\\u0E97\\u0E99-\\u0E9F\\u0EA1-\\u0EA3\\u0EA5\\u0EA7\\u0EAA\\u0EAB\\u0EAD-\\u0EB0\\u0EB2\\u0EB3\\u0EBD\\u0EC0-\\u0EC4\\u0EC6\\u0EDC\\u0EDD\\u0F00\\u0F40-\\u0F47\\u0F49-\\u0F6C\\u0F88-\\u0F8B\\u1000-\\u102A\\u103F\\u1050-\\u1055\\u105A-\\u105D\\u1061\\u1065\\u1066\\u106E-\\u1070\\u1075-\\u1081\\u108E\\u10A0-\\u10C5\\u10D0-\\u10FA\\u10FC\\u1100-\\u1159\\u115F-\\u11A2\\u11A8-\\u11F9\\u1200-\\u1248\\u124A-\\u124D\\u1250-\\u1256\\u1258\\u125A-\\u125D\\u1260-\\u1288\\u128A-\\u128D\\u1290-\\u12B0\\u12B2-\\u12B5\\u12B8-\\u12BE\\u12C0\\u12C2-\\u12C5\\u12C8-\\u12D6\\u12D8-\\u1310\\u1312-\\u1315\\u1318-\\u135A\\u1380-\\u138F\\u13A0-\\u13F4\\u1401-\\u166C\\u166F-\\u1676\\u1681-\\u169A\\u16A0-\\u16EA\\u1700-\\u170C\\u170E-\\u1711\\u1720-\\u1731\\u1740-\\u1751\\u1760-\\u176C\\u176E-\\u1770\\u1780-\\u17B3\\u17D7\\u17DC\\u1820-\\u1877\\u1880-\\u18A8\\u18AA\\u1900-\\u191C\\u1950-\\u196D\\u1970-\\u1974\\u1980-\\u19A9\\u19C1-\\u19C7\\u1A00-\\u1A16\\u1B05-\\u1B33\\u1B45-\\u1B4B\\u1B83-\\u1BA0\\u1BAE\\u1BAF\\u1C00-\\u1C23\\u1C4D-\\u1C4F\\u1C5A-\\u1C7D\\u1D00-\\u1DBF\\u1E00-\\u1F15\\u1F18-\\u1F1D\\u1F20-\\u1F45\\u1F48-\\u1F4D\\u1F50-\\u1F57\\u1F59\\u1F5B\\u1F5D\\u1F5F-\\u1F7D\\u1F80-\\u1FB4\\u1FB6-\\u1FBC\\u1FBE\\u1FC2-\\u1FC4\\u1FC6-\\u1FCC\\u1FD0-\\u1FD3\\u1FD6-\\u1FDB\\u1FE0-\\u1FEC\\u1FF2-\\u1FF4\\u1FF6-\\u1FFC\\u2071\\u207F\\u2090-\\u2094\\u2102\\u2107\\u210A-\\u2113\\u2115\\u2119-\\u211D\\u2124\\u2126\\u2128\\u212A-\\u212D\\u212F-\\u2139\\u213C-\\u213F\\u2145-\\u2149\\u214E\\u2183\\u2184\\u2C00-\\u2C2E\\u2C30-\\u2C5E\\u2C60-\\u2C6F\\u2C71-\\u2C7D\\u2C80-\\u2CE4\\u2D00-\\u2D25\\u2D30-\\u2D65\\u2D6F\\u2D80-\\u2D96\\u2DA0-\\u2DA6\\u2DA8-\\u2DAE\\u2DB0-\\u2DB6\\u2DB8-\\u2DBE\\u2DC0-\\u2DC6\\u2DC8-\\u2DCE\\u2DD0-\\u2DD6\\u2DD8-\\u2DDE\\u2E2F\\u3005\\u3006\\u3031-\\u3035\\u303B\\u303C\\u3041-\\u3096\\u309D-\\u309F\\u30A1-\\u30FA\\u30FC-\\u30FF\\u3105-\\u312D\\u3131-\\u318E\\u31A0-\\u31B7\\u31F0-\\u31FF\\u3400\\u4DB5\\u4E00\\u9FC3\\uA000-\\uA48C\\uA500-\\uA60C\\uA610-\\uA61F\\uA62A\\uA62B\\uA640-\\uA65F\\uA662-\\uA66E\\uA67F-\\uA697\\uA717-\\uA71F\\uA722-\\uA788\\uA78B\\uA78C\\uA7FB-\\uA801\\uA803-\\uA805\\uA807-\\uA80A\\uA80C-\\uA822\\uA840-\\uA873\\uA882-\\uA8B3\\uA90A-\\uA925\\uA930-\\uA946\\uAA00-\\uAA28\\uAA40-\\uAA42\\uAA44-\\uAA4B\\uAC00\\uD7A3\\uF900-\\uFA2D\\uFA30-\\uFA6A\\uFA70-\\uFAD9\\uFB00-\\uFB06\\uFB13-\\uFB17\\uFB1D\\uFB1F-\\uFB28\\uFB2A-\\uFB36\\uFB38-\\uFB3C\\uFB3E\\uFB40\\uFB41\\uFB43\\uFB44\\uFB46-\\uFBB1\\uFBD3-\\uFD3D\\uFD50-\\uFD8F\\uFD92-\\uFDC7\\uFDF0-\\uFDFB\\uFE70-\\uFE74\\uFE76-\\uFEFC\\uFF21-\\uFF3A\\uFF41-\\uFF5A\\uFF66-\\uFFBE\\uFFC2-\\uFFC7\\uFFCA-\\uFFCF\\uFFD2-\\uFFD7\\uFFDA-\\uFFDC]"),
                non_spacing_mark: new RegExp("[\\u0300-\\u036F\\u0483-\\u0487\\u0591-\\u05BD\\u05BF\\u05C1\\u05C2\\u05C4\\u05C5\\u05C7\\u0610-\\u061A\\u064B-\\u065E\\u0670\\u06D6-\\u06DC\\u06DF-\\u06E4\\u06E7\\u06E8\\u06EA-\\u06ED\\u0711\\u0730-\\u074A\\u07A6-\\u07B0\\u07EB-\\u07F3\\u0816-\\u0819\\u081B-\\u0823\\u0825-\\u0827\\u0829-\\u082D\\u0900-\\u0902\\u093C\\u0941-\\u0948\\u094D\\u0951-\\u0955\\u0962\\u0963\\u0981\\u09BC\\u09C1-\\u09C4\\u09CD\\u09E2\\u09E3\\u0A01\\u0A02\\u0A3C\\u0A41\\u0A42\\u0A47\\u0A48\\u0A4B-\\u0A4D\\u0A51\\u0A70\\u0A71\\u0A75\\u0A81\\u0A82\\u0ABC\\u0AC1-\\u0AC5\\u0AC7\\u0AC8\\u0ACD\\u0AE2\\u0AE3\\u0B01\\u0B3C\\u0B3F\\u0B41-\\u0B44\\u0B4D\\u0B56\\u0B62\\u0B63\\u0B82\\u0BC0\\u0BCD\\u0C3E-\\u0C40\\u0C46-\\u0C48\\u0C4A-\\u0C4D\\u0C55\\u0C56\\u0C62\\u0C63\\u0CBC\\u0CBF\\u0CC6\\u0CCC\\u0CCD\\u0CE2\\u0CE3\\u0D41-\\u0D44\\u0D4D\\u0D62\\u0D63\\u0DCA\\u0DD2-\\u0DD4\\u0DD6\\u0E31\\u0E34-\\u0E3A\\u0E47-\\u0E4E\\u0EB1\\u0EB4-\\u0EB9\\u0EBB\\u0EBC\\u0EC8-\\u0ECD\\u0F18\\u0F19\\u0F35\\u0F37\\u0F39\\u0F71-\\u0F7E\\u0F80-\\u0F84\\u0F86\\u0F87\\u0F90-\\u0F97\\u0F99-\\u0FBC\\u0FC6\\u102D-\\u1030\\u1032-\\u1037\\u1039\\u103A\\u103D\\u103E\\u1058\\u1059\\u105E-\\u1060\\u1071-\\u1074\\u1082\\u1085\\u1086\\u108D\\u109D\\u135F\\u1712-\\u1714\\u1732-\\u1734\\u1752\\u1753\\u1772\\u1773\\u17B7-\\u17BD\\u17C6\\u17C9-\\u17D3\\u17DD\\u180B-\\u180D\\u18A9\\u1920-\\u1922\\u1927\\u1928\\u1932\\u1939-\\u193B\\u1A17\\u1A18\\u1A56\\u1A58-\\u1A5E\\u1A60\\u1A62\\u1A65-\\u1A6C\\u1A73-\\u1A7C\\u1A7F\\u1B00-\\u1B03\\u1B34\\u1B36-\\u1B3A\\u1B3C\\u1B42\\u1B6B-\\u1B73\\u1B80\\u1B81\\u1BA2-\\u1BA5\\u1BA8\\u1BA9\\u1C2C-\\u1C33\\u1C36\\u1C37\\u1CD0-\\u1CD2\\u1CD4-\\u1CE0\\u1CE2-\\u1CE8\\u1CED\\u1DC0-\\u1DE6\\u1DFD-\\u1DFF\\u20D0-\\u20DC\\u20E1\\u20E5-\\u20F0\\u2CEF-\\u2CF1\\u2DE0-\\u2DFF\\u302A-\\u302F\\u3099\\u309A\\uA66F\\uA67C\\uA67D\\uA6F0\\uA6F1\\uA802\\uA806\\uA80B\\uA825\\uA826\\uA8C4\\uA8E0-\\uA8F1\\uA926-\\uA92D\\uA947-\\uA951\\uA980-\\uA982\\uA9B3\\uA9B6-\\uA9B9\\uA9BC\\uAA29-\\uAA2E\\uAA31\\uAA32\\uAA35\\uAA36\\uAA43\\uAA4C\\uAAB0\\uAAB2-\\uAAB4\\uAAB7\\uAAB8\\uAABE\\uAABF\\uAAC1\\uABE5\\uABE8\\uABED\\uFB1E\\uFE00-\\uFE0F\\uFE20-\\uFE26]"),
                space_combining_mark: new RegExp("[\\u0903\\u093E-\\u0940\\u0949-\\u094C\\u094E\\u0982\\u0983\\u09BE-\\u09C0\\u09C7\\u09C8\\u09CB\\u09CC\\u09D7\\u0A03\\u0A3E-\\u0A40\\u0A83\\u0ABE-\\u0AC0\\u0AC9\\u0ACB\\u0ACC\\u0B02\\u0B03\\u0B3E\\u0B40\\u0B47\\u0B48\\u0B4B\\u0B4C\\u0B57\\u0BBE\\u0BBF\\u0BC1\\u0BC2\\u0BC6-\\u0BC8\\u0BCA-\\u0BCC\\u0BD7\\u0C01-\\u0C03\\u0C41-\\u0C44\\u0C82\\u0C83\\u0CBE\\u0CC0-\\u0CC4\\u0CC7\\u0CC8\\u0CCA\\u0CCB\\u0CD5\\u0CD6\\u0D02\\u0D03\\u0D3E-\\u0D40\\u0D46-\\u0D48\\u0D4A-\\u0D4C\\u0D57\\u0D82\\u0D83\\u0DCF-\\u0DD1\\u0DD8-\\u0DDF\\u0DF2\\u0DF3\\u0F3E\\u0F3F\\u0F7F\\u102B\\u102C\\u1031\\u1038\\u103B\\u103C\\u1056\\u1057\\u1062-\\u1064\\u1067-\\u106D\\u1083\\u1084\\u1087-\\u108C\\u108F\\u109A-\\u109C\\u17B6\\u17BE-\\u17C5\\u17C7\\u17C8\\u1923-\\u1926\\u1929-\\u192B\\u1930\\u1931\\u1933-\\u1938\\u19B0-\\u19C0\\u19C8\\u19C9\\u1A19-\\u1A1B\\u1A55\\u1A57\\u1A61\\u1A63\\u1A64\\u1A6D-\\u1A72\\u1B04\\u1B35\\u1B3B\\u1B3D-\\u1B41\\u1B43\\u1B44\\u1B82\\u1BA1\\u1BA6\\u1BA7\\u1BAA\\u1C24-\\u1C2B\\u1C34\\u1C35\\u1CE1\\u1CF2\\uA823\\uA824\\uA827\\uA880\\uA881\\uA8B4-\\uA8C3\\uA952\\uA953\\uA983\\uA9B4\\uA9B5\\uA9BA\\uA9BB\\uA9BD-\\uA9C0\\uAA2F\\uAA30\\uAA33\\uAA34\\uAA4D\\uAA7B\\uABE3\\uABE4\\uABE6\\uABE7\\uABE9\\uABEA\\uABEC]"),
                connector_punctuation: new RegExp("[\\u005F\\u203F\\u2040\\u2054\\uFE33\\uFE34\\uFE4D-\\uFE4F\\uFF3F]")
        };

        function is_letter(ch) {
                return UNICODE.letter.test(ch);
        };

        function is_digit(ch) {
                ch = ch.charCodeAt(0);
                return ch >= 48 && ch <= 57; //XXX: find out if "UnicodeDigit" means something else than 0..9
        };

        function is_alphanumeric_char(ch) {
                return is_digit(ch) || is_letter(ch);
        };

        function is_unicode_combining_mark(ch) {
                return UNICODE.non_spacing_mark.test(ch) || UNICODE.space_combining_mark.test(ch);
        };

        function is_unicode_connector_punctuation(ch) {
                return UNICODE.connector_punctuation.test(ch);
        };

        function is_identifier_start(ch) {
                return ch == "$" || ch == "_" || is_letter(ch);
        };

        function is_identifier_char(ch) {
                return is_identifier_start(ch)
                        || is_unicode_combining_mark(ch)
                        || is_digit(ch)
                        || is_unicode_connector_punctuation(ch)
                        || ch == "\u200c" // zero-width non-joiner <ZWNJ>
                        || ch == "\u200d" // zero-width joiner <ZWJ> (in my ECMA-262 PDF, this is also 200c)
                ;
        };

        function parse_js_number(num) {
                if (RE_HEX_NUMBER.test(num)) {
                        return parseInt(num.substr(2), 16);
                } else if (RE_OCT_NUMBER.test(num)) {
                        return parseInt(num.substr(1), 8);
                } else if (RE_DEC_NUMBER.test(num)) {
                        return parseFloat(num);
                }
        };

        function JS_Parse_Error(message, line, col, pos) {
                this.message = message;
                this.line = line;
                this.col = col;
                this.pos = pos;
                try {
                        ({})();
                } catch(ex) {
                        this.stack = ex.stack;
                };
        };

        JS_Parse_Error.prototype.toString = function() {
                return this.message + " (line: " + this.line + ", col: " + this.col + ", pos: " + this.pos + ")" + "\n\n" + this.stack;
        };

        function js_error(message, line, col, pos) {
                throw new JS_Parse_Error(message, line, col, pos);
        };

        function is_token(token, type, val) {
                return token.type == type && (val == null || token.value == val);
        };

        var EX_EOF = {};

        function tokenizer($TEXT) {

                var S = {
                        text            : $TEXT.replace(/\r\n?|[\n\u2028\u2029]/g, "\n").replace(/^\uFEFF/, ''),
                        pos             : 0,
                        tokpos          : 0,
                        line            : 0,
                        tokline         : 0,
                        col             : 0,
                        tokcol          : 0,
                        newline_before  : false,
                        regex_allowed   : false,
                        comments_before : []
                };

                function peek() { return S.text.charAt(S.pos); };

                function next(signal_eof) {
                        var ch = S.text.charAt(S.pos++);
                        if (signal_eof && !ch)
                                throw EX_EOF;
                        if (ch == "\n") {
                                S.newline_before = true;
                                ++S.line;
                                S.col = 0;
                        } else {
                                ++S.col;
                        }
                        return ch;
                };

                function eof() {
                        return !S.peek();
                };

                function find(what, signal_eof) {
                        var pos = S.text.indexOf(what, S.pos);
                        if (signal_eof && pos == -1) throw EX_EOF;
                        return pos;
                };

                function start_token() {
                        S.tokline = S.line;
                        S.tokcol = S.col;
                        S.tokpos = S.pos;
                };

                function token(type, value, is_comment) {
                        S.regex_allowed = ((type == "operator" && !HOP(UNARY_POSTFIX, value)) ||
                                           (type == "keyword" && HOP(KEYWORDS_BEFORE_EXPRESSION, value)) ||
                                           (type == "punc" && HOP(PUNC_BEFORE_EXPRESSION, value)));
                        var ret = {
                                type  : type,
                                value : value,
                                line  : S.tokline,
                                col   : S.tokcol,
                                pos   : S.tokpos,
                                nlb   : S.newline_before
                        };
                        if (!is_comment) {
                                ret.comments_before = S.comments_before;
                                S.comments_before = [];
                        }
                        S.newline_before = false;
                        return ret;
                };

                function skip_whitespace() {
                        while (HOP(WHITESPACE_CHARS, peek()))
                                next();
                };

                function read_while(pred) {
                        var ret = "", ch = peek(), i = 0;
                        while (ch && pred(ch, i++)) {
                                ret += next();
                                ch = peek();
                        }
                        return ret;
                };

                function parse_error(err) {
                        js_error(err, S.tokline, S.tokcol, S.tokpos);
                };

                function read_num(prefix) {
                        var has_e = false, after_e = false, has_x = false, has_dot = prefix == ".";
                        var num = read_while(function(ch, i){
                                if (ch == "x" || ch == "X") {
                                        if (has_x) return false;
                                        return has_x = true;
                                }
                                if (!has_x && (ch == "E" || ch == "e")) {
                                        if (has_e) return false;
                                        return has_e = after_e = true;
                                }
                                if (ch == "-") {
                                        if (after_e || (i == 0 && !prefix)) return true;
                                        return false;
                                }
                                if (ch == "+") return after_e;
                                after_e = false;
                                if (ch == ".") {
                                        if (!has_dot && !has_x)
                                                return has_dot = true;
                                        return false;
                                }
                                return is_alphanumeric_char(ch);
                        });
                        if (prefix)
                                num = prefix + num;
                        var valid = parse_js_number(num);
                        if (!isNaN(valid)) {
                                return token("num", valid);
                        } else {
                                parse_error("Invalid syntax: " + num);
                        }
                };

                function read_escaped_char() {
                        var ch = next(true);
                        switch (ch) {
                            case "n" : return "\n";
                            case "r" : return "\r";
                            case "t" : return "\t";
                            case "b" : return "\b";
                            case "v" : return "\v";
                            case "f" : return "\f";
                            case "0" : return "\0";
                            case "x" : return String.fromCharCode(hex_bytes(2));
                            case "u" : return String.fromCharCode(hex_bytes(4));
                            default  : return ch;
                        }
                };

                function hex_bytes(n) {
                        var num = 0;
                        for (; n > 0; --n) {
                                var digit = parseInt(next(true), 16);
                                if (isNaN(digit))
                                        parse_error("Invalid hex-character pattern in string");
                                num = (num << 4) | digit;
                        }
                        return num;
                };

                function read_string() {
                        return with_eof_error("Unterminated string constant", function(){
                                var quote = next(), ret = "";
                                for (;;) {
                                        var ch = next(true);
                                        if (ch == "\\") ch = read_escaped_char();
                                        else if (ch == quote) break;
                                        ret += ch;
                                }
                                return token("string", ret);
                        });
                };

                function read_line_comment() {
                        next();
                        var i = find("\n"), ret;
                        if (i == -1) {
                                ret = S.text.substr(S.pos);
                                S.pos = S.text.length;
                        } else {
                                ret = S.text.substring(S.pos, i);
                                S.pos = i;
                        }
                        return token("comment1", ret, true);
                };

                function read_multiline_comment() {
                        next();
                        return with_eof_error("Unterminated multiline comment", function(){
                                var i = find("*/", true),
                                    text = S.text.substring(S.pos, i),
                                    tok = token("comment2", text, true);
                                S.pos = i + 2;
                                S.line += text.split("\n").length - 1;
                                S.newline_before = text.indexOf("\n") >= 0;

                                // https://github.com/mishoo/UglifyJS/issues/#issue/100
                                if (/^@cc_on/i.test(text)) {
                                        warn("WARNING: at line " + S.line);
                                        warn("*** Found \"conditional comment\": " + text);
                                        warn("*** UglifyJS DISCARDS ALL COMMENTS.  This means your code might no longer work properly in Internet Explorer.");
                                }

                                return tok;
                        });
                };

                function read_name() {
                        var backslash = false, name = "", ch;
                        while ((ch = peek()) != null) {
                                if (!backslash) {
                                        if (ch == "\\") backslash = true, next();
                                        else if (is_identifier_char(ch)) name += next();
                                        else break;
                                }
                                else {
                                        if (ch != "u") parse_error("Expecting UnicodeEscapeSequence -- uXXXX");
                                        ch = read_escaped_char();
                                        if (!is_identifier_char(ch)) parse_error("Unicode char: " + ch.charCodeAt(0) + " is not valid in identifier");
                                        name += ch;
                                        backslash = false;
                                }
                        }
                        return name;
                };

                function read_regexp() {
                        return with_eof_error("Unterminated regular expression", function(){
                                var prev_backslash = false, regexp = "", ch, in_class = false;
                                while ((ch = next(true))) if (prev_backslash) {
                                        regexp += "\\" + ch;
                                        prev_backslash = false;
                                } else if (ch == "[") {
                                        in_class = true;
                                        regexp += ch;
                                } else if (ch == "]" && in_class) {
                                        in_class = false;
                                        regexp += ch;
                                } else if (ch == "/" && !in_class) {
                                        break;
                                } else if (ch == "\\") {
                                        prev_backslash = true;
                                } else {
                                        regexp += ch;
                                }
                                var mods = read_name();
                                return token("regexp", [ regexp, mods ]);
                        });
                };

                function read_operator(prefix) {
                        function grow(op) {
                                if (!peek()) return op;
                                var bigger = op + peek();
                                if (HOP(OPERATORS, bigger)) {
                                        next();
                                        return grow(bigger);
                                } else {
                                        return op;
                                }
                        };
                        return token("operator", grow(prefix || next()));
                };

                function handle_slash() {
                        next();
                        var regex_allowed = S.regex_allowed;
                        switch (peek()) {
                            case "/":
                                S.comments_before.push(read_line_comment());
                                S.regex_allowed = regex_allowed;
                                return next_token();
                            case "*":
                                S.comments_before.push(read_multiline_comment());
                                S.regex_allowed = regex_allowed;
                                return next_token();
                        }
                        return S.regex_allowed ? read_regexp() : read_operator("/");
                };

                function handle_dot() {
                        next();
                        return is_digit(peek())
                                ? read_num(".")
                                : token("punc", ".");
                };

                function read_word() {
                        var word = read_name();
                        return !HOP(KEYWORDS, word)
                                ? token("name", word)
                                : HOP(OPERATORS, word)
                                ? token("operator", word)
                                : HOP(KEYWORDS_ATOM, word)
                                ? token("atom", word)
                                : token("keyword", word);
                };

                function with_eof_error(eof_error, cont) {
                        try {
                                return cont();
                        } catch(ex) {
                                if (ex === EX_EOF) parse_error(eof_error);
                                else throw ex;
                        }
                };

                function next_token(force_regexp) {
                        if (force_regexp)
                                return read_regexp();
                        skip_whitespace();
                        start_token();
                        var ch = peek();
                        if (!ch) return token("eof");
                        if (is_digit(ch)) return read_num();
                        if (ch == '"' || ch == "'") return read_string();
                        if (HOP(PUNC_CHARS, ch)) return token("punc", next());
                        if (ch == ".") return handle_dot();
                        if (ch == "/") return handle_slash();
                        if (HOP(OPERATOR_CHARS, ch)) return read_operator();
                        if (ch == "\\" || is_identifier_start(ch)) return read_word();
                        parse_error("Unexpected character '" + ch + "'");
                };

                next_token.context = function(nc) {
                        if (nc) S = nc;
                        return S;
                };

                return next_token;

        };

        /* -----[ Parser (constants) ]----- */

        var UNARY_PREFIX = array_to_hash([
                "typeof",
                "void",
                "delete",
                "--",
                "++",
                "!",
                "~",
                "-",
                "+"
        ]);

        var UNARY_POSTFIX = array_to_hash([ "--", "++" ]);

        var ASSIGNMENT = (function(a, ret, i){
                while (i < a.length) {
                        ret[a[i]] = a[i].substr(0, a[i].length - 1);
                        i++;
                }
                return ret;
        })(
                ["+=", "-=", "/=", "*=", "%=", ">>=", "<<=", ">>>=", "|=", "^=", "&="],
                { "=": true },
                0
        );

        var PRECEDENCE = (function(a, ret){
                for (var i = 0, n = 1; i < a.length; ++i, ++n) {
                        var b = a[i];
                        for (var j = 0; j < b.length; ++j) {
                                ret[b[j]] = n;
                        }
                }
                return ret;
        })(
                [
                        ["||"],
                        ["&&"],
                        ["|"],
                        ["^"],
                        ["&"],
                        ["==", "===", "!=", "!=="],
                        ["<", ">", "<=", ">=", "in", "instanceof"],
                        [">>", "<<", ">>>"],
                        ["+", "-"],
                        ["*", "/", "%"]
                ],
                {}
        );

        var STATEMENTS_WITH_LABELS = array_to_hash([ "for", "do", "while", "switch" ]);

        var ATOMIC_START_TOKEN = array_to_hash([ "atom", "num", "string", "regexp", "name" ]);

        /* -----[ Parser ]----- */

        function NodeWithToken(str, start, end) {
                this.name = str;
                this.start = start;
                this.end = end;
        };

        NodeWithToken.prototype.toString = function() { return this.name; };

        function parse($TEXT, exigent_mode, embed_tokens) {

                var S = {
                        input       : typeof $TEXT == "string" ? tokenizer($TEXT, true) : $TEXT,
                        token       : null,
                        prev        : null,
                        peeked      : null,
                        in_function : 0,
                        in_loop     : 0,
                        labels      : []
                };

                S.token = next();

                function is(type, value) {
                        return is_token(S.token, type, value);
                };

                function peek() { return S.peeked || (S.peeked = S.input()); };

                function next() {
                        S.prev = S.token;
                        if (S.peeked) {
                                S.token = S.peeked;
                                S.peeked = null;
                        } else {
                                S.token = S.input();
                        }
                        return S.token;
                };

                function prev() {
                        return S.prev;
                };

                function croak(msg, line, col, pos) {
                        var ctx = S.input.context();
                        js_error(msg,
                                 line != null ? line : ctx.tokline,
                                 col != null ? col : ctx.tokcol,
                                 pos != null ? pos : ctx.tokpos);
                };

                function token_error(token, msg) {
                        croak(msg, token.line, token.col);
                };

                function unexpected(token) {
                        if (token == null)
                                token = S.token;
                        token_error(token, "Unexpected token: " + token.type + " (" + token.value + ")");
                };

                function expect_token(type, val) {
                        if (is(type, val)) {
                                return next();
                        }
                        token_error(S.token, "Unexpected token " + S.token.type + ", expected " + type);
                };

                function expect(punc) { return expect_token("punc", punc); };

                function can_insert_semicolon() {
                        return !exigent_mode && (
                                S.token.nlb || is("eof") || is("punc", "}")
                        );
                };

                function semicolon() {
                        if (is("punc", ";")) next();
                        else if (!can_insert_semicolon()) unexpected();
                };

                function as() {
                        return slice(arguments);
                };

                function parenthesised() {
                        expect("(");
                        var ex = expression();
                        expect(")");
                        return ex;
                };

                function add_tokens(str, start, end) {
                        return str instanceof NodeWithToken ? str : new NodeWithToken(str, start, end);
                };

                var statement = embed_tokens ? function() {
                        var start = S.token;
                        var ast = $statement.apply(this, arguments);
                        ast[0] = add_tokens(ast[0], start, prev());
                        return ast;
                } : $statement;

                function $statement() {
                        if (is("operator", "/")) {
                                S.peeked = null;
                                S.token = S.input(true); // force regexp
                        }
                        switch (S.token.type) {
                            case "num":
                            case "string":
                            case "regexp":
                            case "operator":
                            case "atom":
                                return simple_statement();

                            case "name":
                                return is_token(peek(), "punc", ":")
                                        ? labeled_statement(prog1(S.token.value, next, next))
                                        : simple_statement();

                            case "punc":
                                switch (S.token.value) {
                                    case "{":
                                        return as("block", block_());
                                    case "[":
                                    case "(":
                                        return simple_statement();
                                    case ";":
                                        next();
                                        return as("block");
                                    default:
                                        unexpected();
                                }

                            case "keyword":
                                switch (prog1(S.token.value, next)) {
                                    case "break":
                                        return break_cont("break");

                                    case "continue":
                                        return break_cont("continue");

                                    case "debugger":
                                        semicolon();
                                        return as("debugger");

                                    case "do":
                                        return (function(body){
                                                expect_token("keyword", "while");
                                                return as("do", prog1(parenthesised, semicolon), body);
                                        })(in_loop(statement));

                                    case "for":
                                        return for_();

                                    case "function":
                                        return function_(true);

                                    case "if":
                                        return if_();

                                    case "return":
                                        if (S.in_function == 0)
                                                croak("'return' outside of function");
                                        return as("return",
                                                  is("punc", ";")
                                                  ? (next(), null)
                                                  : can_insert_semicolon()
                                                  ? null
                                                  : prog1(expression, semicolon));

                                    case "switch":
                                        return as("switch", parenthesised(), switch_block_());

                                    case "throw":
                                        return as("throw", prog1(expression, semicolon));

                                    case "try":
                                        return try_();

                                    case "var":
                                        return prog1(var_, semicolon);

                                    case "const":
                                        return prog1(const_, semicolon);

                                    case "while":
                                        return as("while", parenthesised(), in_loop(statement));

                                    case "with":
                                        return as("with", parenthesised(), statement());

                                    default:
                                        unexpected();
                                }
                        }
                };

                function labeled_statement(label) {
                        S.labels.push(label);
                        var start = S.token, stat = statement();
                        if (exigent_mode && !HOP(STATEMENTS_WITH_LABELS, stat[0]))
                                unexpected(start);
                        S.labels.pop();
                        return as("label", label, stat);
                };

                function simple_statement() {
                        return as("stat", prog1(expression, semicolon));
                };

                function break_cont(type) {
                        var name = is("name") ? S.token.value : null;
                        if (name != null) {
                                next();
                                if (!member(name, S.labels))
                                        croak("Label " + name + " without matching loop or statement");
                        }
                        else if (S.in_loop == 0)
                                croak(type + " not inside a loop or switch");
                        semicolon();
                        return as(type, name);
                };

                function for_() {
                        expect("(");
                        var init = null;
                        if (!is("punc", ";")) {
                                init = is("keyword", "var")
                                        ? (next(), var_(true))
                                        : expression(true, true);
                                if (is("operator", "in"))
                                        return for_in(init);
                        }
                        return regular_for(init);
                };

                function regular_for(init) {
                        expect(";");
                        var test = is("punc", ";") ? null : expression();
                        expect(";");
                        var step = is("punc", ")") ? null : expression();
                        expect(")");
                        return as("for", init, test, step, in_loop(statement));
                };

                function for_in(init) {
                        var lhs = init[0] == "var" ? as("name", init[1][0]) : init;
                        next();
                        var obj = expression();
                        expect(")");
                        return as("for-in", init, lhs, obj, in_loop(statement));
                };

                var function_ = embed_tokens ? function() {
                        var start = prev();
                        var ast = $function_.apply(this, arguments);
                        ast[0] = add_tokens(ast[0], start, prev());
                        return ast;
                } : $function_;

                function $function_(in_statement) {
                        var name = is("name") ? prog1(S.token.value, next) : null;
                        if (in_statement && !name)
                                unexpected();
                        expect("(");
                        return as(in_statement ? "defun" : "function",
                                  name,
                                  // arguments
                                  (function(first, a){
                                          while (!is("punc", ")")) {
                                                  if (first) first = false; else expect(",");
                                                  if (!is("name")) unexpected();
                                                  a.push(S.token.value);
                                                  next();
                                          }
                                          next();
                                          return a;
                                  })(true, []),
                                  // body
                                  (function(){
                                          ++S.in_function;
                                          var loop = S.in_loop;
                                          S.in_loop = 0;
                                          var a = block_();
                                          --S.in_function;
                                          S.in_loop = loop;
                                          return a;
                                  })());
                };

                function if_() {
                        var cond = parenthesised(), body = statement(), belse;
                        if (is("keyword", "else")) {
                                next();
                                belse = statement();
                        }
                        return as("if", cond, body, belse);
                };

                function block_() {
                        expect("{");
                        var a = [];
                        while (!is("punc", "}")) {
                                if (is("eof")) unexpected();
                                a.push(statement());
                        }
                        next();
                        return a;
                };

                var switch_block_ = curry(in_loop, function(){
                        expect("{");
                        var a = [], cur = null;
                        while (!is("punc", "}")) {
                                if (is("eof")) unexpected();
                                if (is("keyword", "case")) {
                                        next();
                                        cur = [];
                                        a.push([ expression(), cur ]);
                                        expect(":");
                                }
                                else if (is("keyword", "default")) {
                                        next();
                                        expect(":");
                                        cur = [];
                                        a.push([ null, cur ]);
                                }
                                else {
                                        if (!cur) unexpected();
                                        cur.push(statement());
                                }
                        }
                        next();
                        return a;
                });

                function try_() {
                        var body = block_(), bcatch, bfinally;
                        if (is("keyword", "catch")) {
                                next();
                                expect("(");
                                if (!is("name"))
                                        croak("Name expected");
                                var name = S.token.value;
                                next();
                                expect(")");
                                bcatch = [ name, block_() ];
                        }
                        if (is("keyword", "finally")) {
                                next();
                                bfinally = block_();
                        }
                        if (!bcatch && !bfinally)
                                croak("Missing catch/finally blocks");
                        return as("try", body, bcatch, bfinally);
                };

                function vardefs(no_in) {
                        var a = [];
                        for (;;) {
                                if (!is("name"))
                                        unexpected();
                                var name = S.token.value;
                                next();
                                if (is("operator", "=")) {
                                        next();
                                        a.push([ name, expression(false, no_in) ]);
                                } else {
                                        a.push([ name ]);
                                }
                                if (!is("punc", ","))
                                        break;
                                next();
                        }
                        return a;
                };

                function var_(no_in) {
                        return as("var", vardefs(no_in));
                };

                function const_() {
                        return as("const", vardefs());
                };

                function new_() {
                        var newexp = expr_atom(false), args;
                        if (is("punc", "(")) {
                                next();
                                args = expr_list(")");
                        } else {
                                args = [];
                        }
                        return subscripts(as("new", newexp, args), true);
                };

                function expr_atom(allow_calls) {
                        if (is("operator", "new")) {
                                next();
                                return new_();
                        }
                        if (is("operator") && HOP(UNARY_PREFIX, S.token.value)) {
                                return make_unary("unary-prefix",
                                                  prog1(S.token.value, next),
                                                  expr_atom(allow_calls));
                        }
                        if (is("punc")) {
                                switch (S.token.value) {
                                    case "(":
                                        next();
                                        return subscripts(prog1(expression, curry(expect, ")")), allow_calls);
                                    case "[":
                                        next();
                                        return subscripts(array_(), allow_calls);
                                    case "{":
                                        next();
                                        return subscripts(object_(), allow_calls);
                                }
                                unexpected();
                        }
                        if (is("keyword", "function")) {
                                next();
                                return subscripts(function_(false), allow_calls);
                        }
                        if (HOP(ATOMIC_START_TOKEN, S.token.type)) {
                                var atom = S.token.type == "regexp"
                                        ? as("regexp", S.token.value[0], S.token.value[1])
                                        : as(S.token.type, S.token.value);
                                return subscripts(prog1(atom, next), allow_calls);
                        }
                        unexpected();
                };

                function expr_list(closing, allow_trailing_comma, allow_empty) {
                        var first = true, a = [];
                        while (!is("punc", closing)) {
                                if (first) first = false; else expect(",");
                                if (allow_trailing_comma && is("punc", closing)) break;
                                if (is("punc", ",") && allow_empty) {
                                        a.push([ "atom", "undefined" ]);
                                } else {
                                        a.push(expression(false));
                                }
                        }
                        next();
                        return a;
                };

                function array_() {
                        return as("array", expr_list("]", !exigent_mode, true));
                };

                function object_() {
                        var first = true, a = [];
                        while (!is("punc", "}")) {
                                if (first) first = false; else expect(",");
                                if (!exigent_mode && is("punc", "}"))
                                        // allow trailing comma
                                        break;
                                var type = S.token.type;
                                var name = as_property_name();
                                if (type == "name" && (name == "get" || name == "set") && !is("punc", ":")) {
                                        a.push([ as_name(), function_(false), name ]);
                                } else {
                                        expect(":");
                                        a.push([ name, expression(false) ]);
                                }
                        }
                        next();
                        return as("object", a);
                };

                function as_property_name() {
                        switch (S.token.type) {
                            case "num":
                            case "string":
                                return prog1(S.token.value, next);
                        }
                        return as_name();
                };

                function as_name() {
                        switch (S.token.type) {
                            case "name":
                            case "operator":
                            case "keyword":
                            case "atom":
                                return prog1(S.token.value, next);
                            default:
                                unexpected();
                        }
                };

                function subscripts(expr, allow_calls) {
                        if (is("punc", ".")) {
                                next();
                                return subscripts(as("dot", expr, as_name()), allow_calls);
                        }
                        if (is("punc", "[")) {
                                next();
                                return subscripts(as("sub", expr, prog1(expression, curry(expect, "]"))), allow_calls);
                        }
                        if (allow_calls && is("punc", "(")) {
                                next();
                                return subscripts(as("call", expr, expr_list(")")), true);
                        }
                        if (allow_calls && is("operator") && HOP(UNARY_POSTFIX, S.token.value)) {
                                return prog1(curry(make_unary, "unary-postfix", S.token.value, expr),
                                             next);
                        }
                        return expr;
                };

                function make_unary(tag, op, expr) {
                        if ((op == "++" || op == "--") && !is_assignable(expr))
                                croak("Invalid use of " + op + " operator");
                        return as(tag, op, expr);
                };

                function expr_op(left, min_prec, no_in) {
                        var op = is("operator") ? S.token.value : null;
                        if (op && op == "in" && no_in) op = null;
                        var prec = op != null ? PRECEDENCE[op] : null;
                        if (prec != null && prec > min_prec) {
                                next();
                                var right = expr_op(expr_atom(true), prec, no_in);
                                return expr_op(as("binary", op, left, right), min_prec, no_in);
                        }
                        return left;
                };

                function expr_ops(no_in) {
                        return expr_op(expr_atom(true), 0, no_in);
                };

                function maybe_conditional(no_in) {
                        var expr = expr_ops(no_in);
                        if (is("operator", "?")) {
                                next();
                                var yes = expression(false);
                                expect(":");
                                return as("conditional", expr, yes, expression(false, no_in));
                        }
                        return expr;
                };

                function is_assignable(expr) {
                        if (!exigent_mode) return true;
                        switch (expr[0]) {
                            case "dot":
                            case "sub":
                            case "new":
                            case "call":
                                return true;
                            case "name":
                                return expr[1] != "this";
                        }
                };

                function maybe_assign(no_in) {
                        var left = maybe_conditional(no_in), val = S.token.value;
                        if (is("operator") && HOP(ASSIGNMENT, val)) {
                                if (is_assignable(left)) {
                                        next();
                                        return as("assign", ASSIGNMENT[val], left, maybe_assign(no_in));
                                }
                                croak("Invalid assignment");
                        }
                        return left;
                };

                function expression(commas, no_in) {
                        if (arguments.length == 0)
                                commas = true;
                        var expr = maybe_assign(no_in);
                        if (commas && is("punc", ",")) {
                                next();
                                return as("seq", expr, expression(true, no_in));
                        }
                        return expr;
                };

                function in_loop(cont) {
                        try {
                                ++S.in_loop;
                                return cont();
                        } finally {
                                --S.in_loop;
                        }
                };

                return as("toplevel", (function(a){
                        while (!is("eof"))
                                a.push(statement());
                        return a;
                })([]));

        };

        /* -----[ Utilities ]----- */

        function curry(f) {
                var args = slice(arguments, 1);
                return function() { return f.apply(this, args.concat(slice(arguments))); };
        };

        function prog1(ret) {
                if (ret instanceof Function)
                        ret = ret();
                for (var i = 1, n = arguments.length; --n > 0; ++i)
                        arguments[i]();
                return ret;
        };

        function array_to_hash(a) {
                var ret = {};
                for (var i = 0; i < a.length; ++i)
                        ret[a[i]] = true;
                return ret;
        };

        function slice(a, start) {
                return Array.prototype.slice.call(a, start == null ? 0 : start);
        };

        function characters(str) {
                return str.split("");
        };

        function member(name, array) {
                for (var i = array.length; --i >= 0;)
                        if (array[i] === name)
                                return true;
                return false;
        };

        function HOP(obj, prop) {
                return Object.prototype.hasOwnProperty.call(obj, prop);
        };

        var warn = function() {};

        return parse;

    })();
    
    var esprima = { };
    
    /*
      Copyright (C) 2012 Ariya Hidayat <ariya.hidayat@gmail.com>
      Copyright (C) 2012 Mathias Bynens <mathias@qiwi.be>
      Copyright (C) 2012 Joost-Wim Boekesteijn <joost-wim@boekesteijn.nl>
      Copyright (C) 2012 Kris Kowal <kris.kowal@cixar.com>
      Copyright (C) 2012 Yusuke Suzuki <utatane.tea@gmail.com>
      Copyright (C) 2012 Arpad Borsos <arpad.borsos@googlemail.com>
      Copyright (C) 2011 Ariya Hidayat <ariya.hidayat@gmail.com>

      Redistribution and use in source and binary forms, with or without
      modification, are permitted provided that the following conditions are met:

        * Redistributions of source code must retain the above copyright
          notice, this list of conditions and the following disclaimer.
        * Redistributions in binary form must reproduce the above copyright
          notice, this list of conditions and the following disclaimer in the
          documentation and/or other materials provided with the distribution.

      THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
      AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
      IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
      ARE DISCLAIMED. IN NO EVENT SHALL <COPYRIGHT HOLDER> BE LIABLE FOR ANY
      DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
      (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
      LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
      ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
      (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
      THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
    */
    (function (exports) {
        'use strict';

        var Token,
            TokenName,
            Syntax,
            PropertyKind,
            Messages,
            Regex,
            source,
            strict,
            index,
            lineNumber,
            lineStart,
            length,
            buffer,
            state,
            extra;

        Token = {
            BooleanLiteral: 1,
            EOF: 2,
            Identifier: 3,
            Keyword: 4,
            NullLiteral: 5,
            NumericLiteral: 6,
            Punctuator: 7,
            StringLiteral: 8
        };

        TokenName = {};
        TokenName[Token.BooleanLiteral] = 'Boolean';
        TokenName[Token.EOF] = '<end>';
        TokenName[Token.Identifier] = 'Identifier';
        TokenName[Token.Keyword] = 'Keyword';
        TokenName[Token.NullLiteral] = 'Null';
        TokenName[Token.NumericLiteral] = 'Numeric';
        TokenName[Token.Punctuator] = 'Punctuator';
        TokenName[Token.StringLiteral] = 'String';

        Syntax = {
            AssignmentExpression: 'AssignmentExpression',
            ArrayExpression: 'ArrayExpression',
            BlockStatement: 'BlockStatement',
            BinaryExpression: 'BinaryExpression',
            BreakStatement: 'BreakStatement',
            CallExpression: 'CallExpression',
            CatchClause: 'CatchClause',
            ConditionalExpression: 'ConditionalExpression',
            ContinueStatement: 'ContinueStatement',
            DoWhileStatement: 'DoWhileStatement',
            DebuggerStatement: 'DebuggerStatement',
            EmptyStatement: 'EmptyStatement',
            ExpressionStatement: 'ExpressionStatement',
            ForStatement: 'ForStatement',
            ForInStatement: 'ForInStatement',
            FunctionDeclaration: 'FunctionDeclaration',
            FunctionExpression: 'FunctionExpression',
            Identifier: 'Identifier',
            IfStatement: 'IfStatement',
            Literal: 'Literal',
            LabeledStatement: 'LabeledStatement',
            LogicalExpression: 'LogicalExpression',
            MemberExpression: 'MemberExpression',
            NewExpression: 'NewExpression',
            ObjectExpression: 'ObjectExpression',
            Program: 'Program',
            Property: 'Property',
            ReturnStatement: 'ReturnStatement',
            SequenceExpression: 'SequenceExpression',
            SwitchStatement: 'SwitchStatement',
            SwitchCase: 'SwitchCase',
            ThisExpression: 'ThisExpression',
            ThrowStatement: 'ThrowStatement',
            TryStatement: 'TryStatement',
            UnaryExpression: 'UnaryExpression',
            UpdateExpression: 'UpdateExpression',
            VariableDeclaration: 'VariableDeclaration',
            VariableDeclarator: 'VariableDeclarator',
            WhileStatement: 'WhileStatement',
            WithStatement: 'WithStatement'
        };

        PropertyKind = {
            Data: 1,
            Get: 2,
            Set: 4
        };

        // Error messages should be identical to V8.
        Messages = {
            UnexpectedToken:  'Unexpected token %0',
            UnexpectedNumber:  'Unexpected number',
            UnexpectedString:  'Unexpected string',
            UnexpectedIdentifier:  'Unexpected identifier',
            UnexpectedReserved:  'Unexpected reserved word',
            UnexpectedEOS:  'Unexpected end of input',
            NewlineAfterThrow:  'Illegal newline after throw',
            InvalidRegExp: 'Invalid regular expression',
            UnterminatedRegExp:  'Invalid regular expression: missing /',
            InvalidLHSInAssignment:  'Invalid left-hand side in assignment',
            InvalidLHSInForIn:  'Invalid left-hand side in for-in',
            MultipleDefaultsInSwitch: 'More than one default clause in switch statement',
            NoCatchOrFinally:  'Missing catch or finally after try',
            UnknownLabel: 'Undefined label \'%0\'',
            Redeclaration: '%0 \'%1\' has already been declared',
            IllegalContinue: 'Illegal continue statement',
            IllegalBreak: 'Illegal break statement',
            IllegalReturn: 'Illegal return statement',
            StrictModeWith:  'Strict mode code may not include a with statement',
            StrictCatchVariable:  'Catch variable may not be eval or arguments in strict mode',
            StrictVarName:  'Variable name may not be eval or arguments in strict mode',
            StrictParamName:  'Parameter name eval or arguments is not allowed in strict mode',
            StrictParamDupe: 'Strict mode function may not have duplicate parameter names',
            StrictFunctionName:  'Function name may not be eval or arguments in strict mode',
            StrictOctalLiteral:  'Octal literals are not allowed in strict mode.',
            StrictDelete:  'Delete of an unqualified identifier in strict mode.',
            StrictDuplicateProperty:  'Duplicate data property in object literal not allowed in strict mode',
            AccessorDataProperty:  'Object literal may not have data and accessor property with the same name',
            AccessorGetSet:  'Object literal may not have multiple get/set accessors with the same name',
            StrictLHSAssignment:  'Assignment to eval or arguments is not allowed in strict mode',
            StrictLHSPostfix:  'Postfix increment/decrement may not have eval or arguments operand in strict mode',
            StrictLHSPrefix:  'Prefix increment/decrement may not have eval or arguments operand in strict mode',
            StrictReservedWord:  'Use of future reserved word in strict mode'
        };

        // See also tools/generate-unicode-regex.py.
        Regex = {
            NonAsciiIdentifierStart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]'),
            NonAsciiIdentifierPart: new RegExp('[\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0300-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u0483-\u0487\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u05d0-\u05ea\u05f0-\u05f2\u0610-\u061a\u0620-\u0669\u066e-\u06d3\u06d5-\u06dc\u06df-\u06e8\u06ea-\u06fc\u06ff\u0710-\u074a\u074d-\u07b1\u07c0-\u07f5\u07fa\u0800-\u082d\u0840-\u085b\u08a0\u08a2-\u08ac\u08e4-\u08fe\u0900-\u0963\u0966-\u096f\u0971-\u0977\u0979-\u097f\u0981-\u0983\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bc-\u09c4\u09c7\u09c8\u09cb-\u09ce\u09d7\u09dc\u09dd\u09df-\u09e3\u09e6-\u09f1\u0a01-\u0a03\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a59-\u0a5c\u0a5e\u0a66-\u0a75\u0a81-\u0a83\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ad0\u0ae0-\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3c-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b5c\u0b5d\u0b5f-\u0b63\u0b66-\u0b6f\u0b71\u0b82\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd0\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c58\u0c59\u0c60-\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0cde\u0ce0-\u0ce3\u0ce6-\u0cef\u0cf1\u0cf2\u0d02\u0d03\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d-\u0d44\u0d46-\u0d48\u0d4a-\u0d4e\u0d57\u0d60-\u0d63\u0d66-\u0d6f\u0d7a-\u0d7f\u0d82\u0d83\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e01-\u0e3a\u0e40-\u0e4e\u0e50-\u0e59\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb9\u0ebb-\u0ebd\u0ec0-\u0ec4\u0ec6\u0ec8-\u0ecd\u0ed0-\u0ed9\u0edc-\u0edf\u0f00\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e-\u0f47\u0f49-\u0f6c\u0f71-\u0f84\u0f86-\u0f97\u0f99-\u0fbc\u0fc6\u1000-\u1049\u1050-\u109d\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u135d-\u135f\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176c\u176e-\u1770\u1772\u1773\u1780-\u17d3\u17d7\u17dc\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u1820-\u1877\u1880-\u18aa\u18b0-\u18f5\u1900-\u191c\u1920-\u192b\u1930-\u193b\u1946-\u196d\u1970-\u1974\u1980-\u19ab\u19b0-\u19c9\u19d0-\u19d9\u1a00-\u1a1b\u1a20-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1aa7\u1b00-\u1b4b\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1bf3\u1c00-\u1c37\u1c40-\u1c49\u1c4d-\u1c7d\u1cd0-\u1cd2\u1cd4-\u1cf6\u1d00-\u1de6\u1dfc-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u200c\u200d\u203f\u2040\u2054\u2071\u207f\u2090-\u209c\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d7f-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2de0-\u2dff\u2e2f\u3005-\u3007\u3021-\u302f\u3031-\u3035\u3038-\u303c\u3041-\u3096\u3099\u309a\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua62b\ua640-\ua66f\ua674-\ua67d\ua67f-\ua697\ua69f-\ua6f1\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua827\ua840-\ua873\ua880-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f7\ua8fb\ua900-\ua92d\ua930-\ua953\ua960-\ua97c\ua980-\ua9c0\ua9cf-\ua9d9\uaa00-\uaa36\uaa40-\uaa4d\uaa50-\uaa59\uaa60-\uaa76\uaa7a\uaa7b\uaa80-\uaac2\uaadb-\uaadd\uaae0-\uaaef\uaaf2-\uaaf6\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabea\uabec\uabed\uabf0-\uabf9\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\ufe70-\ufe74\ufe76-\ufefc\uff10-\uff19\uff21-\uff3a\uff3f\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc]')
        };

        // Ensure the condition is true, otherwise throw an error.
        // This is only to have a better contract semantic, i.e. another safety net
        // to catch a logic error. The condition shall be fulfilled in normal case.
        // Do NOT use this to enforce a certain condition on any user input.

        function assert(condition, message) {
            if (!condition) {
                throw new Error('ASSERT: ' + message);
            }
        }

        function sliceSource(from, to) {
            return source.slice(from, to);
        }

        if (typeof 'esprima'[0] === 'undefined') {
            sliceSource = function sliceArraySource(from, to) {
                return source.slice(from, to).join('');
            };
        }

        function isDecimalDigit(ch) {
            return '0123456789'.indexOf(ch) >= 0;
        }

        function isHexDigit(ch) {
            return '0123456789abcdefABCDEF'.indexOf(ch) >= 0;
        }

        function isOctalDigit(ch) {
            return '01234567'.indexOf(ch) >= 0;
        }


        // 7.2 White Space

        function isWhiteSpace(ch) {
            return (ch === ' ') || (ch === '\u0009') || (ch === '\u000B') ||
                (ch === '\u000C') || (ch === '\u00A0') ||
                (ch.charCodeAt(0) >= 0x1680 &&
                 '\u1680\u180E\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u202F\u205F\u3000\uFEFF'.indexOf(ch) >= 0);
        }

        // 7.3 Line Terminators

        function isLineTerminator(ch) {
            return (ch === '\n' || ch === '\r' || ch === '\u2028' || ch === '\u2029');
        }

        // 7.6 Identifier Names and Identifiers

        function isIdentifierStart(ch) {
            return (ch === '$') || (ch === '_') || (ch === '\\') ||
                (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
                ((ch.charCodeAt(0) >= 0x80) && Regex.NonAsciiIdentifierStart.test(ch));
        }

        function isIdentifierPart(ch) {
            return (ch === '$') || (ch === '_') || (ch === '\\') ||
                (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') ||
                ((ch >= '0') && (ch <= '9')) ||
                ((ch.charCodeAt(0) >= 0x80) && Regex.NonAsciiIdentifierPart.test(ch));
        }

        // 7.6.1.2 Future Reserved Words

        function isFutureReservedWord(id) {
            switch (id) {

            // Future reserved words.
            case 'class':
            case 'enum':
            case 'export':
            case 'extends':
            case 'import':
            case 'super':
                return true;
            }

            return false;
        }

        function isStrictModeReservedWord(id) {
            switch (id) {

            // Strict Mode reserved words.
            case 'implements':
            case 'interface':
            case 'package':
            case 'private':
            case 'protected':
            case 'public':
            case 'static':
            case 'yield':
            case 'let':
                return true;
            }

            return false;
        }

        function isRestrictedWord(id) {
            return id === 'eval' || id === 'arguments';
        }

        // 7.6.1.1 Keywords

        function isKeyword(id) {
            var keyword = false;
            switch (id.length) {
            case 2:
                keyword = (id === 'if') || (id === 'in') || (id === 'do');
                break;
            case 3:
                keyword = (id === 'var') || (id === 'for') || (id === 'new') || (id === 'try');
                break;
            case 4:
                keyword = (id === 'this') || (id === 'else') || (id === 'case') || (id === 'void') || (id === 'with');
                break;
            case 5:
                keyword = (id === 'while') || (id === 'break') || (id === 'catch') || (id === 'throw');
                break;
            case 6:
                keyword = (id === 'return') || (id === 'typeof') || (id === 'delete') || (id === 'switch');
                break;
            case 7:
                keyword = (id === 'default') || (id === 'finally');
                break;
            case 8:
                keyword = (id === 'function') || (id === 'continue') || (id === 'debugger');
                break;
            case 10:
                keyword = (id === 'instanceof');
                break;
            }

            if (keyword) {
                return true;
            }

            switch (id) {
            // Future reserved words.
            // 'const' is specialized as Keyword in V8.
            case 'const':
                return true;

            // For compatiblity to SpiderMonkey and ES.next
            case 'yield':
            case 'let':
                return true;
            }

            if (strict && isStrictModeReservedWord(id)) {
                return true;
            }

            return isFutureReservedWord(id);
        }

        // Return the next character and move forward.

        function nextChar() {
            return source[index++];
        }

        // 7.4 Comments

        function skipComment() {
            var ch, blockComment, lineComment;

            blockComment = false;
            lineComment = false;

            while (index < length) {
                ch = source[index];

                if (lineComment) {
                    ch = nextChar();
                    if (isLineTerminator(ch)) {
                        lineComment = false;
                        if (ch === '\r' && source[index] === '\n') {
                            ++index;
                        }
                        ++lineNumber;
                        lineStart = index;
                    }
                } else if (blockComment) {
                    if (isLineTerminator(ch)) {
                        if (ch === '\r' && source[index + 1] === '\n') {
                            ++index;
                        }
                        ++lineNumber;
                        ++index;
                        lineStart = index;
                        if (index >= length) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    } else {
                        ch = nextChar();
                        if (index >= length) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                        if (ch === '*') {
                            ch = source[index];
                            if (ch === '/') {
                                ++index;
                                blockComment = false;
                            }
                        }
                    }
                } else if (ch === '/') {
                    ch = source[index + 1];
                    if (ch === '/') {
                        index += 2;
                        lineComment = true;
                    } else if (ch === '*') {
                        index += 2;
                        blockComment = true;
                        if (index >= length) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    } else {
                        break;
                    }
                } else if (isWhiteSpace(ch)) {
                    ++index;
                } else if (isLineTerminator(ch)) {
                    ++index;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                } else {
                    break;
                }
            }
        }

        function scanHexEscape(prefix) {
            var i, len, ch, code = 0;

            len = (prefix === 'u') ? 4 : 2;
            for (i = 0; i < len; ++i) {
                if (index < length && isHexDigit(source[index])) {
                    ch = nextChar();
                    code = code * 16 + '0123456789abcdef'.indexOf(ch.toLowerCase());
                } else {
                    return '';
                }
            }
            return String.fromCharCode(code);
        }

        function scanIdentifier() {
            var ch, start, id, restore;

            ch = source[index];
            if (!isIdentifierStart(ch)) {
                return;
            }

            start = index;
            if (ch === '\\') {
                ++index;
                if (source[index] !== 'u') {
                    return;
                }
                ++index;
                restore = index;
                ch = scanHexEscape('u');
                if (ch) {
                    if (ch === '\\' || !isIdentifierStart(ch)) {
                        return;
                    }
                    id = ch;
                } else {
                    index = restore;
                    id = 'u';
                }
            } else {
                id = nextChar();
            }

            while (index < length) {
                ch = source[index];
                if (!isIdentifierPart(ch)) {
                    break;
                }
                if (ch === '\\') {
                    ++index;
                    if (source[index] !== 'u') {
                        return;
                    }
                    ++index;
                    restore = index;
                    ch = scanHexEscape('u');
                    if (ch) {
                        if (ch === '\\' || !isIdentifierPart(ch)) {
                            return;
                        }
                        id += ch;
                    } else {
                        index = restore;
                        id += 'u';
                    }
                } else {
                    id += nextChar();
                }
            }

            // There is no keyword or literal with only one character.
            // Thus, it must be an identifier.
            if (id.length === 1) {
                return {
                    type: Token.Identifier,
                    value: id,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            if (isKeyword(id)) {
                return {
                    type: Token.Keyword,
                    value: id,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            // 7.8.1 Null Literals

            if (id === 'null') {
                return {
                    type: Token.NullLiteral,
                    value: id,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            // 7.8.2 Boolean Literals

            if (id === 'true' || id === 'false') {
                return {
                    type: Token.BooleanLiteral,
                    value: id,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            return {
                type: Token.Identifier,
                value: id,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // 7.7 Punctuators

        function scanPunctuator() {
            var start = index,
                ch1 = source[index],
                ch2,
                ch3,
                ch4;

            // Check for most common single-character punctuators.

            if (ch1 === ';' || ch1 === '{' || ch1 === '}') {
                ++index;
                return {
                    type: Token.Punctuator,
                    value: ch1,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            if (ch1 === ',' || ch1 === '(' || ch1 === ')') {
                ++index;
                return {
                    type: Token.Punctuator,
                    value: ch1,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            // Dot (.) can also start a floating-point number, hence the need
            // to check the next character.

            ch2 = source[index + 1];
            if (ch1 === '.' && !isDecimalDigit(ch2)) {
                return {
                    type: Token.Punctuator,
                    value: nextChar(),
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            // Peek more characters.

            ch3 = source[index + 2];
            ch4 = source[index + 3];

            // 4-character punctuator: >>>=

            if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
                if (ch4 === '=') {
                    index += 4;
                    return {
                        type: Token.Punctuator,
                        value: '>>>=',
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                }
            }

            // 3-character punctuators: === !== >>> <<= >>=

            if (ch1 === '=' && ch2 === '=' && ch3 === '=') {
                index += 3;
                return {
                    type: Token.Punctuator,
                    value: '===',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            if (ch1 === '!' && ch2 === '=' && ch3 === '=') {
                index += 3;
                return {
                    type: Token.Punctuator,
                    value: '!==',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            if (ch1 === '>' && ch2 === '>' && ch3 === '>') {
                index += 3;
                return {
                    type: Token.Punctuator,
                    value: '>>>',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            if (ch1 === '<' && ch2 === '<' && ch3 === '=') {
                index += 3;
                return {
                    type: Token.Punctuator,
                    value: '<<=',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            if (ch1 === '>' && ch2 === '>' && ch3 === '=') {
                index += 3;
                return {
                    type: Token.Punctuator,
                    value: '>>=',
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }

            // 2-character punctuators: <= >= == != ++ -- << >> && ||
            // += -= *= %= &= |= ^= /=

            if (ch2 === '=') {
                if ('<>=!+-*%&|^/'.indexOf(ch1) >= 0) {
                    index += 2;
                    return {
                        type: Token.Punctuator,
                        value: ch1 + ch2,
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                }
            }

            if (ch1 === ch2 && ('+-<>&|'.indexOf(ch1) >= 0)) {
                if ('+-<>&|'.indexOf(ch2) >= 0) {
                    index += 2;
                    return {
                        type: Token.Punctuator,
                        value: ch1 + ch2,
                        lineNumber: lineNumber,
                        lineStart: lineStart,
                        range: [start, index]
                    };
                }
            }

            // The remaining 1-character punctuators.

            if ('[]<>+-*%&|^!~?:=/'.indexOf(ch1) >= 0) {
                return {
                    type: Token.Punctuator,
                    value: nextChar(),
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [start, index]
                };
            }
        }

        // 7.8.3 Numeric Literals

        function scanNumericLiteral() {
            var number, start, ch;

            ch = source[index];
            assert(isDecimalDigit(ch) || (ch === '.'),
                'Numeric literal must start with a decimal digit or a decimal point');

            start = index;
            number = '';
            if (ch !== '.') {
                number = nextChar();
                ch = source[index];

                // Hex number starts with '0x'.
                // Octal number starts with '0'.
                if (number === '0') {
                    if (ch === 'x' || ch === 'X') {
                        number += nextChar();
                        while (index < length) {
                            ch = source[index];
                            if (!isHexDigit(ch)) {
                                break;
                            }
                            number += nextChar();
                        }

                        if (number.length <= 2) {
                            // only 0x
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }

                        if (index < length) {
                            ch = source[index];
                            if (isIdentifierStart(ch)) {
                                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                            }
                        }
                        return {
                            type: Token.NumericLiteral,
                            value: parseInt(number, 16),
                            lineNumber: lineNumber,
                            lineStart: lineStart,
                            range: [start, index]
                        };
                    } else if (isOctalDigit(ch)) {
                        number += nextChar();
                        while (index < length) {
                            ch = source[index];
                            if (!isOctalDigit(ch)) {
                                break;
                            }
                            number += nextChar();
                        }

                        if (index < length) {
                            ch = source[index];
                            if (isIdentifierStart(ch) || isDecimalDigit(ch)) {
                                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                            }
                        }
                        return {
                            type: Token.NumericLiteral,
                            value: parseInt(number, 8),
                            octal: true,
                            lineNumber: lineNumber,
                            lineStart: lineStart,
                            range: [start, index]
                        };
                    }

                    // decimal number starts with '0' such as '09' is illegal.
                    if (isDecimalDigit(ch)) {
                        throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                    }
                }

                while (index < length) {
                    ch = source[index];
                    if (!isDecimalDigit(ch)) {
                        break;
                    }
                    number += nextChar();
                }
            }

            if (ch === '.') {
                number += nextChar();
                while (index < length) {
                    ch = source[index];
                    if (!isDecimalDigit(ch)) {
                        break;
                    }
                    number += nextChar();
                }
            }

            if (ch === 'e' || ch === 'E') {
                number += nextChar();

                ch = source[index];
                if (ch === '+' || ch === '-') {
                    number += nextChar();
                }

                ch = source[index];
                if (isDecimalDigit(ch)) {
                    number += nextChar();
                    while (index < length) {
                        ch = source[index];
                        if (!isDecimalDigit(ch)) {
                            break;
                        }
                        number += nextChar();
                    }
                } else {
                    ch = 'character ' + ch;
                    if (index >= length) {
                        ch = '<end>';
                    }
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            if (index < length) {
                ch = source[index];
                if (isIdentifierStart(ch)) {
                    throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                }
            }

            return {
                type: Token.NumericLiteral,
                value: parseFloat(number),
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        // 7.8.4 String Literals

        function scanStringLiteral() {
            var str = '', quote, start, ch, code, unescaped, restore, octal = false;

            quote = source[index];
            assert((quote === '\'' || quote === '"'),
                'String literal must starts with a quote');

            start = index;
            ++index;

            while (index < length) {
                ch = nextChar();

                if (ch === quote) {
                    quote = '';
                    break;
                } else if (ch === '\\') {
                    ch = nextChar();
                    if (!isLineTerminator(ch)) {
                        switch (ch) {
                        case 'n':
                            str += '\n';
                            break;
                        case 'r':
                            str += '\r';
                            break;
                        case 't':
                            str += '\t';
                            break;
                        case 'u':
                        case 'x':
                            restore = index;
                            unescaped = scanHexEscape(ch);
                            if (unescaped) {
                                str += unescaped;
                            } else {
                                index = restore;
                                str += ch;
                            }
                            break;
                        case 'b':
                            str += '\b';
                            break;
                        case 'f':
                            str += '\f';
                            break;
                        case 'v':
                            str += '\v';
                            break;

                        default:
                            if (isOctalDigit(ch)) {
                                code = '01234567'.indexOf(ch);

                                // \0 is not octal escape sequence
                                if (code !== 0) {
                                    octal = true;
                                }

                                if (index < length && isOctalDigit(source[index])) {
                                    octal = true;
                                    code = code * 8 + '01234567'.indexOf(nextChar());

                                    // 3 digits are only allowed when string starts
                                    // with 0, 1, 2, 3
                                    if ('0123'.indexOf(ch) >= 0 &&
                                            index < length &&
                                            isOctalDigit(source[index])) {
                                        code = code * 8 + '01234567'.indexOf(nextChar());
                                    }
                                }
                                str += String.fromCharCode(code);
                            } else {
                                str += ch;
                            }
                            break;
                        }
                    } else {
                        ++lineNumber;
                        if (ch ===  '\r' && source[index] === '\n') {
                            ++index;
                        }
                    }
                } else if (isLineTerminator(ch)) {
                    break;
                } else {
                    str += ch;
                }
            }

            if (quote !== '') {
                throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
            }

            return {
                type: Token.StringLiteral,
                value: str,
                octal: octal,
                lineNumber: lineNumber,
                lineStart: lineStart,
                range: [start, index]
            };
        }

        function scanRegExp() {
            var str = '', ch, start, pattern, flags, value, classMarker = false, restore, terminated = false;

            buffer = null;
            skipComment();

            start = index;
            ch = source[index];
            assert(ch === '/', 'Regular expression literal must start with a slash');
            str = nextChar();

            while (index < length) {
                ch = nextChar();
                str += ch;
                if (classMarker) {
                    if (ch === ']') {
                        classMarker = false;
                    }
                } else {
                    if (ch === '\\') {
                        ch = nextChar();
                        // ECMA-262 7.8.5
                        if (isLineTerminator(ch)) {
                            throwError({}, Messages.UnterminatedRegExp);
                        }
                        str += ch;
                    } else if (ch === '/') {
                        terminated = true;
                        break;
                    } else if (ch === '[') {
                        classMarker = true;
                    } else if (isLineTerminator(ch)) {
                        throwError({}, Messages.UnterminatedRegExp);
                    }
                }
            }

            if (!terminated) {
                throwError({}, Messages.UnterminatedRegExp);
            }

            // Exclude leading and trailing slash.
            pattern = str.substr(1, str.length - 2);

            flags = '';
            while (index < length) {
                ch = source[index];
                if (!isIdentifierPart(ch)) {
                    break;
                }

                ++index;
                if (ch === '\\' && index < length) {
                    ch = source[index];
                    if (ch === 'u') {
                        ++index;
                        restore = index;
                        ch = scanHexEscape('u');
                        if (ch) {
                            flags += ch;
                            str += '\\u';
                            for (; restore < index; ++restore) {
                                str += source[restore];
                            }
                        } else {
                            index = restore;
                            flags += 'u';
                            str += '\\u';
                        }
                    } else {
                        str += '\\';
                    }
                } else {
                    flags += ch;
                    str += ch;
                }
            }

            try {
                value = new RegExp(pattern, flags);
            } catch (e) {
                throwError({}, Messages.InvalidRegExp);
            }

            return {
                literal: str,
                value: value,
                range: [start, index]
            };
        }

        function isIdentifierName(token) {
            return token.type === Token.Identifier ||
                token.type === Token.Keyword ||
                token.type === Token.BooleanLiteral ||
                token.type === Token.NullLiteral;
        }

        function advance() {
            var ch, token;

            skipComment();

            if (index >= length) {
                return {
                    type: Token.EOF,
                    lineNumber: lineNumber,
                    lineStart: lineStart,
                    range: [index, index]
                };
            }

            token = scanPunctuator();
            if (typeof token !== 'undefined') {
                return token;
            }

            ch = source[index];

            if (ch === '\'' || ch === '"') {
                return scanStringLiteral();
            }

            if (ch === '.' || isDecimalDigit(ch)) {
                return scanNumericLiteral();
            }

            token = scanIdentifier();
            if (typeof token !== 'undefined') {
                return token;
            }

            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
        }

        function lex() {
            var token;

            if (buffer) {
                index = buffer.range[1];
                lineNumber = buffer.lineNumber;
                lineStart = buffer.lineStart;
                token = buffer;
                buffer = null;
                return token;
            }

            buffer = null;
            return advance();
        }

        function lookahead() {
            var pos, line, start;

            if (buffer !== null) {
                return buffer;
            }

            pos = index;
            line = lineNumber;
            start = lineStart;
            buffer = advance();
            index = pos;
            lineNumber = line;
            lineStart = start;

            return buffer;
        }

        // Return true if there is a line terminator before the next token.

        function peekLineTerminator() {
            var pos, line, start, found;

            pos = index;
            line = lineNumber;
            start = lineStart;
            skipComment();
            found = lineNumber !== line;
            index = pos;
            lineNumber = line;
            lineStart = start;

            return found;
        }

        // Throw an exception

        function throwError(token, messageFormat) {
            var error,
                args = Array.prototype.slice.call(arguments, 2),
                msg = messageFormat.replace(
                    /%(\d)/g,
                    function (whole, index) {
                        return args[index] || '';
                    }
                );

            if (typeof token.lineNumber === 'number') {
                error = new Error('Line ' + token.lineNumber + ': ' + msg);
                error.index = token.range[0];
                error.lineNumber = token.lineNumber;
                error.column = token.range[0] - lineStart + 1;
            } else {
                error = new Error('Line ' + lineNumber + ': ' + msg);
                error.index = index;
                error.lineNumber = lineNumber;
                error.column = index - lineStart + 1;
            }

            throw error;
        }

        function throwErrorTolerant() {
            try {
                throwError.apply(null, arguments);
            } catch (e) {
                if (extra.errors) {
                    extra.errors.push(e);
                } else {
                    throw e;
                }
            }
        }


        // Throw an exception because of the token.

        function throwUnexpected(token) {
            if (token.type === Token.EOF) {
                throwError(token, Messages.UnexpectedEOS);
            }

            if (token.type === Token.NumericLiteral) {
                throwError(token, Messages.UnexpectedNumber);
            }

            if (token.type === Token.StringLiteral) {
                throwError(token, Messages.UnexpectedString);
            }

            if (token.type === Token.Identifier) {
                throwError(token, Messages.UnexpectedIdentifier);
            }

            if (token.type === Token.Keyword) {
                if (isFutureReservedWord(token.value)) {
                    throwError(token, Messages.UnexpectedReserved);
                } else if (strict && isStrictModeReservedWord(token.value)) {
                    throwError(token, Messages.StrictReservedWord);
                }
                throwError(token, Messages.UnexpectedToken, token.value);
            }

            // BooleanLiteral, NullLiteral, or Punctuator.
            throwError(token, Messages.UnexpectedToken, token.value);
        }

        // Expect the next token to match the specified punctuator.
        // If not, an exception will be thrown.

        function expect(value) {
            var token = lex();
            if (token.type !== Token.Punctuator || token.value !== value) {
                throwUnexpected(token);
            }
        }

        // Expect the next token to match the specified keyword.
        // If not, an exception will be thrown.

        function expectKeyword(keyword) {
            var token = lex();
            if (token.type !== Token.Keyword || token.value !== keyword) {
                throwUnexpected(token);
            }
        }

        // Return true if the next token matches the specified punctuator.

        function match(value) {
            var token = lookahead();
            return token.type === Token.Punctuator && token.value === value;
        }

        // Return true if the next token matches the specified keyword

        function matchKeyword(keyword) {
            var token = lookahead();
            return token.type === Token.Keyword && token.value === keyword;
        }

        // Return true if the next token is an assignment operator

        function matchAssign() {
            var token = lookahead(),
                op = token.value;

            if (token.type !== Token.Punctuator) {
                return false;
            }
            return op === '=' ||
                op === '*=' ||
                op === '/=' ||
                op === '%=' ||
                op === '+=' ||
                op === '-=' ||
                op === '<<=' ||
                op === '>>=' ||
                op === '>>>=' ||
                op === '&=' ||
                op === '^=' ||
                op === '|=';
        }

        function consumeSemicolon() {
            var token, line;

            // Catch the very common case first.
            if (source[index] === ';') {
                lex();
                return;
            }

            line = lineNumber;
            skipComment();
            if (lineNumber !== line) {
                return;
            }

            if (match(';')) {
                lex();
                return;
            }

            token = lookahead();
            if (token.type !== Token.EOF && !match('}')) {
                throwUnexpected(token);
            }
            return;
        }

        // Return true if provided expression is LeftHandSideExpression

        function isLeftHandSide(expr) {
            return expr.type === Syntax.Identifier || expr.type === Syntax.MemberExpression;
        }

        // 11.1.4 Array Initialiser

        function parseArrayInitialiser() {
            var elements = [];

            expect('[');

            while (!match(']')) {
                if (match(',')) {
                    lex();
                    elements.push(null);
                } else {
                    elements.push(parseAssignmentExpression());

                    if (!match(']')) {
                        expect(',');
                    }
                }
            }

            expect(']');

            return {
                type: Syntax.ArrayExpression,
                elements: elements
            };
        }

        // 11.1.5 Object Initialiser

        function parsePropertyFunction(param, first) {
            var previousStrict, body;

            previousStrict = strict;
            body = parseFunctionSourceElements();
            if (first && strict && isRestrictedWord(param[0].name)) {
                throwError(first, Messages.StrictParamName);
            }
            strict = previousStrict;

            return {
                type: Syntax.FunctionExpression,
                id: null,
                params: param,
                defaults: [],
                body: body,
                rest: null,
                generator: false,
                expression: false
            };
        }

        function parseObjectPropertyKey() {
            var token = lex();

            // Note: This function is called only from parseObjectProperty(), where
            // EOF and Punctuator tokens are already filtered out.

            if (token.type === Token.StringLiteral || token.type === Token.NumericLiteral) {
                if (strict && token.octal) {
                    throwError(token, Messages.StrictOctalLiteral);
                }
                return createLiteral(token);
            }

            return {
                type: Syntax.Identifier,
                name: token.value
            };
        }

        function parseObjectProperty() {
            var token, key, id, param;

            token = lookahead();

            if (token.type === Token.Identifier) {

                id = parseObjectPropertyKey();

                // Property Assignment: Getter and Setter.

                if (token.value === 'get' && !match(':')) {
                    key = parseObjectPropertyKey();
                    expect('(');
                    expect(')');
                    return {
                        type: Syntax.Property,
                        key: key,
                        value: parsePropertyFunction([]),
                        kind: 'get'
                    };
                } else if (token.value === 'set' && !match(':')) {
                    key = parseObjectPropertyKey();
                    expect('(');
                    token = lookahead();
                    if (token.type !== Token.Identifier) {
                        throwUnexpected(lex());
                    }
                    param = [ parseVariableIdentifier() ];
                    expect(')');
                    return {
                        type: Syntax.Property,
                        key: key,
                        value: parsePropertyFunction(param, token),
                        kind: 'set'
                    };
                } else {
                    expect(':');
                    return {
                        type: Syntax.Property,
                        key: id,
                        value: parseAssignmentExpression(),
                        kind: 'init'
                    };
                }
            } else if (token.type === Token.EOF || token.type === Token.Punctuator) {
                throwUnexpected(token);
            } else {
                key = parseObjectPropertyKey();
                expect(':');
                return {
                    type: Syntax.Property,
                    key: key,
                    value: parseAssignmentExpression(),
                    kind: 'init'
                };
            }
        }

        function parseObjectInitialiser() {
            var properties = [], property, name, kind, map = {}, toString = String;

            expect('{');

            while (!match('}')) {
                property = parseObjectProperty();

                if (property.key.type === Syntax.Identifier) {
                    name = property.key.name;
                } else {
                    name = toString(property.key.value);
                }
                kind = (property.kind === 'init') ? PropertyKind.Data : (property.kind === 'get') ? PropertyKind.Get : PropertyKind.Set;
                if (Object.prototype.hasOwnProperty.call(map, name)) {
                    if (map[name] === PropertyKind.Data) {
                        if (strict && kind === PropertyKind.Data) {
                            throwErrorTolerant({}, Messages.StrictDuplicateProperty);
                        } else if (kind !== PropertyKind.Data) {
                            throwError({}, Messages.AccessorDataProperty);
                        }
                    } else {
                        if (kind === PropertyKind.Data) {
                            throwError({}, Messages.AccessorDataProperty);
                        } else if (map[name] & kind) {
                            throwError({}, Messages.AccessorGetSet);
                        }
                    }
                    map[name] |= kind;
                } else {
                    map[name] = kind;
                }

                properties.push(property);

                if (!match('}')) {
                    expect(',');
                }
            }

            expect('}');

            return {
                type: Syntax.ObjectExpression,
                properties: properties
            };
        }

        // 11.1 Primary Expressions

        function parsePrimaryExpression() {
            var expr,
                token = lookahead(),
                type = token.type;

            if (type === Token.Identifier) {
                return {
                    type: Syntax.Identifier,
                    name: lex().value
                };
            }

            if (type === Token.StringLiteral || type === Token.NumericLiteral) {
                if (strict && token.octal) {
                    throwErrorTolerant(token, Messages.StrictOctalLiteral);
                }
                return createLiteral(lex());
            }

            if (type === Token.Keyword) {
                if (matchKeyword('this')) {
                    lex();
                    return {
                        type: Syntax.ThisExpression
                    };
                }

                if (matchKeyword('function')) {
                    return parseFunctionExpression();
                }
            }

            if (type === Token.BooleanLiteral) {
                lex();
                token.value = (token.value === 'true');
                return createLiteral(token);
            }

            if (type === Token.NullLiteral) {
                lex();
                token.value = null;
                return createLiteral(token);
            }

            if (match('[')) {
                return parseArrayInitialiser();
            }

            if (match('{')) {
                return parseObjectInitialiser();
            }

            if (match('(')) {
                lex();
                state.lastParenthesized = expr = parseExpression();
                expect(')');
                return expr;
            }

            if (match('/') || match('/=')) {
                return createLiteral(scanRegExp());
            }

            return throwUnexpected(lex());
        }

        // 11.2 Left-Hand-Side Expressions

        function parseArguments() {
            var args = [];

            expect('(');

            if (!match(')')) {
                while (index < length) {
                    args.push(parseAssignmentExpression());
                    if (match(')')) {
                        break;
                    }
                    expect(',');
                }
            }

            expect(')');

            return args;
        }

        function parseNonComputedProperty() {
            var token = lex();

            if (!isIdentifierName(token)) {
                throwUnexpected(token);
            }

            return {
                type: Syntax.Identifier,
                name: token.value
            };
        }

        function parseNonComputedMember(object) {
            return {
                type: Syntax.MemberExpression,
                computed: false,
                object: object,
                property: parseNonComputedProperty()
            };
        }

        function parseComputedMember(object) {
            var property, expr;

            expect('[');
            property = parseExpression();
            expr = {
                type: Syntax.MemberExpression,
                computed: true,
                object: object,
                property: property
            };
            expect(']');
            return expr;
        }

        function parseCallMember(object) {
            return {
                type: Syntax.CallExpression,
                callee: object,
                'arguments': parseArguments()
            };
        }

        function parseNewExpression() {
            var expr;

            expectKeyword('new');

            expr = {
                type: Syntax.NewExpression,
                callee: parseLeftHandSideExpression(),
                'arguments': []
            };

            if (match('(')) {
                expr['arguments'] = parseArguments();
            }

            return expr;
        }

        function parseLeftHandSideExpressionAllowCall() {
            var useNew, expr;

            useNew = matchKeyword('new');
            expr = useNew ? parseNewExpression() : parsePrimaryExpression();

            while (index < length) {
                if (match('.')) {
                    lex();
                    expr = parseNonComputedMember(expr);
                } else if (match('[')) {
                    expr = parseComputedMember(expr);
                } else if (match('(')) {
                    expr = parseCallMember(expr);
                } else {
                    break;
                }
            }

            return expr;
        }

        function parseLeftHandSideExpression() {
            var useNew, expr;

            useNew = matchKeyword('new');
            expr = useNew ? parseNewExpression() : parsePrimaryExpression();

            while (index < length) {
                if (match('.')) {
                    lex();
                    expr = parseNonComputedMember(expr);
                } else if (match('[')) {
                    expr = parseComputedMember(expr);
                } else {
                    break;
                }
            }

            return expr;
        }

        // 11.3 Postfix Expressions

        function parsePostfixExpression() {
            var expr = parseLeftHandSideExpressionAllowCall();

            if ((match('++') || match('--')) && !peekLineTerminator()) {
                // 11.3.1, 11.3.2
                if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                    throwError({}, Messages.StrictLHSPostfix);
                }

                if (!isLeftHandSide(expr)) {
                    throwError({}, Messages.InvalidLHSInAssignment);
                }

                expr = {
                    type: Syntax.UpdateExpression,
                    operator: lex().value,
                    argument: expr,
                    prefix: false
                };
            }

            return expr;
        }

        // 11.4 Unary Operators

        function parseUnaryExpression() {
            var token, expr;

            if (match('++') || match('--')) {
                token = lex();
                expr = parseUnaryExpression();
                // 11.4.4, 11.4.5
                if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                    throwError({}, Messages.StrictLHSPrefix);
                }

                if (!isLeftHandSide(expr)) {
                    throwError({}, Messages.InvalidLHSInAssignment);
                }

                expr = {
                    type: Syntax.UpdateExpression,
                    operator: token.value,
                    argument: expr,
                    prefix: true
                };
                return expr;
            }

            if (match('+') || match('-') || match('~') || match('!')) {
                expr = {
                    type: Syntax.UnaryExpression,
                    operator: lex().value,
                    argument: parseUnaryExpression()
                };
                return expr;
            }

            if (matchKeyword('delete') || matchKeyword('void') || matchKeyword('typeof')) {
                expr = {
                    type: Syntax.UnaryExpression,
                    operator: lex().value,
                    argument: parseUnaryExpression()
                };
                if (strict && expr.operator === 'delete' && expr.argument.type === Syntax.Identifier) {
                    throwErrorTolerant({}, Messages.StrictDelete);
                }
                return expr;
            }

            return parsePostfixExpression();
        }

        // 11.5 Multiplicative Operators

        function parseMultiplicativeExpression() {
            var expr = parseUnaryExpression();

            while (match('*') || match('/') || match('%')) {
                expr = {
                    type: Syntax.BinaryExpression,
                    operator: lex().value,
                    left: expr,
                    right: parseUnaryExpression()
                };
            }

            return expr;
        }

        // 11.6 Additive Operators

        function parseAdditiveExpression() {
            var expr = parseMultiplicativeExpression();

            while (match('+') || match('-')) {
                expr = {
                    type: Syntax.BinaryExpression,
                    operator: lex().value,
                    left: expr,
                    right: parseMultiplicativeExpression()
                };
            }

            return expr;
        }

        // 11.7 Bitwise Shift Operators

        function parseShiftExpression() {
            var expr = parseAdditiveExpression();

            while (match('<<') || match('>>') || match('>>>')) {
                expr = {
                    type: Syntax.BinaryExpression,
                    operator: lex().value,
                    left: expr,
                    right: parseAdditiveExpression()
                };
            }

            return expr;
        }
        // 11.8 Relational Operators

        function parseRelationalExpression() {
            var expr, previousAllowIn;

            previousAllowIn = state.allowIn;
            state.allowIn = true;

            expr = parseShiftExpression();

            while (match('<') || match('>') || match('<=') || match('>=') || (previousAllowIn && matchKeyword('in')) || matchKeyword('instanceof')) {
                expr = {
                    type: Syntax.BinaryExpression,
                    operator: lex().value,
                    left: expr,
                    right: parseShiftExpression()
                };
            }

            state.allowIn = previousAllowIn;
            return expr;
        }

        // 11.9 Equality Operators

        function parseEqualityExpression() {
            var expr = parseRelationalExpression();

            while (match('==') || match('!=') || match('===') || match('!==')) {
                expr = {
                    type: Syntax.BinaryExpression,
                    operator: lex().value,
                    left: expr,
                    right: parseRelationalExpression()
                };
            }

            return expr;
        }

        // 11.10 Binary Bitwise Operators

        function parseBitwiseANDExpression() {
            var expr = parseEqualityExpression();

            while (match('&')) {
                lex();
                expr = {
                    type: Syntax.BinaryExpression,
                    operator: '&',
                    left: expr,
                    right: parseEqualityExpression()
                };
            }

            return expr;
        }

        function parseBitwiseXORExpression() {
            var expr = parseBitwiseANDExpression();

            while (match('^')) {
                lex();
                expr = {
                    type: Syntax.BinaryExpression,
                    operator: '^',
                    left: expr,
                    right: parseBitwiseANDExpression()
                };
            }

            return expr;
        }

        function parseBitwiseORExpression() {
            var expr = parseBitwiseXORExpression();

            while (match('|')) {
                lex();
                expr = {
                    type: Syntax.BinaryExpression,
                    operator: '|',
                    left: expr,
                    right: parseBitwiseXORExpression()
                };
            }

            return expr;
        }

        // 11.11 Binary Logical Operators

        function parseLogicalANDExpression() {
            var expr = parseBitwiseORExpression();

            while (match('&&')) {
                lex();
                expr = {
                    type: Syntax.LogicalExpression,
                    operator: '&&',
                    left: expr,
                    right: parseBitwiseORExpression()
                };
            }

            return expr;
        }

        function parseLogicalORExpression() {
            var expr = parseLogicalANDExpression();

            while (match('||')) {
                lex();
                expr = {
                    type: Syntax.LogicalExpression,
                    operator: '||',
                    left: expr,
                    right: parseLogicalANDExpression()
                };
            }

            return expr;
        }

        // 11.12 Conditional Operator

        function parseConditionalExpression() {
            var expr, previousAllowIn, consequent;

            expr = parseLogicalORExpression();

            if (match('?')) {
                lex();
                previousAllowIn = state.allowIn;
                state.allowIn = true;
                consequent = parseAssignmentExpression();
                state.allowIn = previousAllowIn;
                expect(':');

                expr = {
                    type: Syntax.ConditionalExpression,
                    test: expr,
                    consequent: consequent,
                    alternate: parseAssignmentExpression()
                };
            }

            return expr;
        }

        // 11.13 Assignment Operators

        function parseAssignmentExpression() {
            var expr;

            expr = parseConditionalExpression();

            if (matchAssign()) {
                // LeftHandSideExpression
                if (!isLeftHandSide(expr)) {
                    throwError({}, Messages.InvalidLHSInAssignment);
                }

                // 11.13.1
                if (strict && expr.type === Syntax.Identifier && isRestrictedWord(expr.name)) {
                    throwError({}, Messages.StrictLHSAssignment);
                }

                expr = {
                    type: Syntax.AssignmentExpression,
                    operator: lex().value,
                    left: expr,
                    right: parseAssignmentExpression()
                };
            }

            return expr;
        }

        // 11.14 Comma Operator

        function parseExpression() {
            var expr = parseAssignmentExpression();

            if (match(',')) {
                expr = {
                    type: Syntax.SequenceExpression,
                    expressions: [ expr ]
                };

                while (index < length) {
                    if (!match(',')) {
                        break;
                    }
                    lex();
                    expr.expressions.push(parseAssignmentExpression());
                }

            }
            return expr;
        }

        // 12.1 Block

        function parseStatementList() {
            var list = [],
                statement;

            while (index < length) {
                if (match('}')) {
                    break;
                }
                statement = parseSourceElement();
                if (typeof statement === 'undefined') {
                    break;
                }
                list.push(statement);
            }

            return list;
        }

        function parseBlock() {
            var block;

            expect('{');

            block = parseStatementList();

            expect('}');

            return {
                type: Syntax.BlockStatement,
                body: block
            };
        }

        // 12.2 Variable Statement

        function parseVariableIdentifier() {
            var token = lex();

            if (token.type !== Token.Identifier) {
                throwUnexpected(token);
            }

            return {
                type: Syntax.Identifier,
                name: token.value
            };
        }

        function parseVariableDeclaration(kind) {
            var id = parseVariableIdentifier(),
                init = null;

            // 12.2.1
            if (strict && isRestrictedWord(id.name)) {
                throwErrorTolerant({}, Messages.StrictVarName);
            }

            if (kind === 'const') {
                expect('=');
                init = parseAssignmentExpression();
            } else if (match('=')) {
                lex();
                init = parseAssignmentExpression();
            }

            return {
                type: Syntax.VariableDeclarator,
                id: id,
                init: init
            };
        }

        function parseVariableDeclarationList(kind) {
            var list = [];

            while (index < length) {
                list.push(parseVariableDeclaration(kind));
                if (!match(',')) {
                    break;
                }
                lex();
            }

            return list;
        }

        function parseVariableStatement() {
            var declarations;

            expectKeyword('var');

            declarations = parseVariableDeclarationList();

            consumeSemicolon();

            return {
                type: Syntax.VariableDeclaration,
                declarations: declarations,
                kind: 'var'
            };
        }

        // kind may be `const` or `let`
        // Both are experimental and not in the specification yet.
        // see http://wiki.ecmascript.org/doku.php?id=harmony:const
        // and http://wiki.ecmascript.org/doku.php?id=harmony:let
        function parseConstLetDeclaration(kind) {
            var declarations;

            expectKeyword(kind);

            declarations = parseVariableDeclarationList(kind);

            consumeSemicolon();

            return {
                type: Syntax.VariableDeclaration,
                declarations: declarations,
                kind: kind
            };
        }

        // 12.3 Empty Statement

        function parseEmptyStatement() {
            expect(';');

            return {
                type: Syntax.EmptyStatement
            };
        }

        // 12.4 Expression Statement

        function parseExpressionStatement() {
            var expr = parseExpression();

            consumeSemicolon();

            return {
                type: Syntax.ExpressionStatement,
                expression: expr
            };
        }

        // 12.5 If statement

        function parseIfStatement() {
            var test, consequent, alternate;

            expectKeyword('if');

            expect('(');

            test = parseExpression();

            expect(')');

            consequent = parseStatement();

            if (matchKeyword('else')) {
                lex();
                alternate = parseStatement();
            } else {
                alternate = null;
            }

            return {
                type: Syntax.IfStatement,
                test: test,
                consequent: consequent,
                alternate: alternate
            };
        }

        // 12.6 Iteration Statements

        function parseDoWhileStatement() {
            var body, test, oldInIteration;

            expectKeyword('do');

            oldInIteration = state.inIteration;
            state.inIteration = true;

            body = parseStatement();

            state.inIteration = oldInIteration;

            expectKeyword('while');

            expect('(');

            test = parseExpression();

            expect(')');

            if (match(';')) {
                lex();
            }

            return {
                type: Syntax.DoWhileStatement,
                body: body,
                test: test
            };
        }

        function parseWhileStatement() {
            var test, body, oldInIteration;

            expectKeyword('while');

            expect('(');

            test = parseExpression();

            expect(')');

            oldInIteration = state.inIteration;
            state.inIteration = true;

            body = parseStatement();

            state.inIteration = oldInIteration;

            return {
                type: Syntax.WhileStatement,
                test: test,
                body: body
            };
        }

        function parseForVariableDeclaration() {
            var token = lex();

            return {
                type: Syntax.VariableDeclaration,
                declarations: parseVariableDeclarationList(),
                kind: token.value
            };
        }

        function parseForStatement() {
            var init, test, update, left, right, body, oldInIteration;

            init = test = update = null;

            expectKeyword('for');

            expect('(');

            if (match(';')) {
                lex();
            } else {
                if (matchKeyword('var') || matchKeyword('let')) {
                    state.allowIn = false;
                    init = parseForVariableDeclaration();
                    state.allowIn = true;

                    if (init.declarations.length === 1 && matchKeyword('in')) {
                        lex();
                        left = init;
                        right = parseExpression();
                        init = null;
                    }
                } else {
                    state.allowIn = false;
                    init = parseExpression();
                    state.allowIn = true;

                    if (matchKeyword('in')) {
                        // LeftHandSideExpression
                        if (!isLeftHandSide(init)) {
                            throwError({}, Messages.InvalidLHSInForIn);
                        }

                        lex();
                        left = init;
                        right = parseExpression();
                        init = null;
                    }
                }

                if (typeof left === 'undefined') {
                    expect(';');
                }
            }

            if (typeof left === 'undefined') {

                if (!match(';')) {
                    test = parseExpression();
                }
                expect(';');

                if (!match(')')) {
                    update = parseExpression();
                }
            }

            expect(')');

            oldInIteration = state.inIteration;
            state.inIteration = true;

            body = parseStatement();

            state.inIteration = oldInIteration;

            if (typeof left === 'undefined') {
                return {
                    type: Syntax.ForStatement,
                    init: init,
                    test: test,
                    update: update,
                    body: body
                };
            }

            return {
                type: Syntax.ForInStatement,
                left: left,
                right: right,
                body: body,
                each: false
            };
        }

        // 12.7 The continue statement

        function parseContinueStatement() {
            var token, label = null;

            expectKeyword('continue');

            // Optimize the most common form: 'continue;'.
            if (source[index] === ';') {
                lex();

                if (!state.inIteration) {
                    throwError({}, Messages.IllegalContinue);
                }

                return {
                    type: Syntax.ContinueStatement,
                    label: null
                };
            }

            if (peekLineTerminator()) {
                if (!state.inIteration) {
                    throwError({}, Messages.IllegalContinue);
                }

                return {
                    type: Syntax.ContinueStatement,
                    label: null
                };
            }

            token = lookahead();
            if (token.type === Token.Identifier) {
                label = parseVariableIdentifier();

                if (!Object.prototype.hasOwnProperty.call(state.labelSet, label.name)) {
                    throwError({}, Messages.UnknownLabel, label.name);
                }
            }

            consumeSemicolon();

            if (label === null && !state.inIteration) {
                throwError({}, Messages.IllegalContinue);
            }

            return {
                type: Syntax.ContinueStatement,
                label: label
            };
        }

        // 12.8 The break statement

        function parseBreakStatement() {
            var token, label = null;

            expectKeyword('break');

            // Optimize the most common form: 'break;'.
            if (source[index] === ';') {
                lex();

                if (!(state.inIteration || state.inSwitch)) {
                    throwError({}, Messages.IllegalBreak);
                }

                return {
                    type: Syntax.BreakStatement,
                    label: null
                };
            }

            if (peekLineTerminator()) {
                if (!(state.inIteration || state.inSwitch)) {
                    throwError({}, Messages.IllegalBreak);
                }

                return {
                    type: Syntax.BreakStatement,
                    label: null
                };
            }

            token = lookahead();
            if (token.type === Token.Identifier) {
                label = parseVariableIdentifier();

                if (!Object.prototype.hasOwnProperty.call(state.labelSet, label.name)) {
                    throwError({}, Messages.UnknownLabel, label.name);
                }
            }

            consumeSemicolon();

            if (label === null && !(state.inIteration || state.inSwitch)) {
                throwError({}, Messages.IllegalBreak);
            }

            return {
                type: Syntax.BreakStatement,
                label: label
            };
        }

        // 12.9 The return statement

        function parseReturnStatement() {
            var token, argument = null;

            expectKeyword('return');

            if (!state.inFunctionBody) {
                throwErrorTolerant({}, Messages.IllegalReturn);
            }

            // 'return' followed by a space and an identifier is very common.
            if (source[index] === ' ') {
                if (isIdentifierStart(source[index + 1])) {
                    argument = parseExpression();
                    consumeSemicolon();
                    return {
                        type: Syntax.ReturnStatement,
                        argument: argument
                    };
                }
            }

            if (peekLineTerminator()) {
                return {
                    type: Syntax.ReturnStatement,
                    argument: null
                };
            }

            if (!match(';')) {
                token = lookahead();
                if (!match('}') && token.type !== Token.EOF) {
                    argument = parseExpression();
                }
            }

            consumeSemicolon();

            return {
                type: Syntax.ReturnStatement,
                argument: argument
            };
        }

        // 12.10 The with statement

        function parseWithStatement() {
            var object, body;

            if (strict) {
                throwErrorTolerant({}, Messages.StrictModeWith);
            }

            expectKeyword('with');

            expect('(');

            object = parseExpression();

            expect(')');

            body = parseStatement();

            return {
                type: Syntax.WithStatement,
                object: object,
                body: body
            };
        }

        // 12.10 The swith statement

        function parseSwitchCase() {
            var test,
                consequent = [],
                statement;

            if (matchKeyword('default')) {
                lex();
                test = null;
            } else {
                expectKeyword('case');
                test = parseExpression();
            }
            expect(':');

            while (index < length) {
                if (match('}') || matchKeyword('default') || matchKeyword('case')) {
                    break;
                }
                statement = parseStatement();
                if (typeof statement === 'undefined') {
                    break;
                }
                consequent.push(statement);
            }

            return {
                type: Syntax.SwitchCase,
                test: test,
                consequent: consequent
            };
        }

        function parseSwitchStatement() {
            var discriminant, cases, clause, oldInSwitch, defaultFound;

            expectKeyword('switch');

            expect('(');

            discriminant = parseExpression();

            expect(')');

            expect('{');

            if (match('}')) {
                lex();
                return {
                    type: Syntax.SwitchStatement,
                    discriminant: discriminant
                };
            }

            cases = [];

            oldInSwitch = state.inSwitch;
            state.inSwitch = true;
            defaultFound = false;

            while (index < length) {
                if (match('}')) {
                    break;
                }
                clause = parseSwitchCase();
                if (clause.test === null) {
                    if (defaultFound) {
                        throwError({}, Messages.MultipleDefaultsInSwitch);
                    }
                    defaultFound = true;
                }
                cases.push(clause);
            }

            state.inSwitch = oldInSwitch;

            expect('}');

            return {
                type: Syntax.SwitchStatement,
                discriminant: discriminant,
                cases: cases
            };
        }

        // 12.13 The throw statement

        function parseThrowStatement() {
            var argument;

            expectKeyword('throw');

            if (peekLineTerminator()) {
                throwError({}, Messages.NewlineAfterThrow);
            }

            argument = parseExpression();

            consumeSemicolon();

            return {
                type: Syntax.ThrowStatement,
                argument: argument
            };
        }

        // 12.14 The try statement

        function parseCatchClause() {
            var param;

            expectKeyword('catch');

            expect('(');
            if (!match(')')) {
                param = parseExpression();
                // 12.14.1
                if (strict && param.type === Syntax.Identifier && isRestrictedWord(param.name)) {
                    throwErrorTolerant({}, Messages.StrictCatchVariable);
                }
            }
            expect(')');

            return {
                type: Syntax.CatchClause,
                param: param,
                body: parseBlock()
            };
        }

        function parseTryStatement() {
            var block, handlers = [], finalizer = null;

            expectKeyword('try');

            block = parseBlock();

            if (matchKeyword('catch')) {
                handlers.push(parseCatchClause());
            }

            if (matchKeyword('finally')) {
                lex();
                finalizer = parseBlock();
            }

            if (handlers.length === 0 && !finalizer) {
                throwError({}, Messages.NoCatchOrFinally);
            }

            return {
                type: Syntax.TryStatement,
                block: block,
                guardedHandlers: [],
                handlers: handlers,
                finalizer: finalizer
            };
        }

        // 12.15 The debugger statement

        function parseDebuggerStatement() {
            expectKeyword('debugger');

            consumeSemicolon();

            return {
                type: Syntax.DebuggerStatement
            };
        }

        // 12 Statements

        function parseStatement() {
            var token = lookahead(),
                expr,
                labeledBody;

            if (token.type === Token.EOF) {
                throwUnexpected(token);
            }

            if (token.type === Token.Punctuator) {
                switch (token.value) {
                case ';':
                    return parseEmptyStatement();
                case '{':
                    return parseBlock();
                case '(':
                    return parseExpressionStatement();
                default:
                    break;
                }
            }

            if (token.type === Token.Keyword) {
                switch (token.value) {
                case 'break':
                    return parseBreakStatement();
                case 'continue':
                    return parseContinueStatement();
                case 'debugger':
                    return parseDebuggerStatement();
                case 'do':
                    return parseDoWhileStatement();
                case 'for':
                    return parseForStatement();
                case 'function':
                    return parseFunctionDeclaration();
                case 'if':
                    return parseIfStatement();
                case 'return':
                    return parseReturnStatement();
                case 'switch':
                    return parseSwitchStatement();
                case 'throw':
                    return parseThrowStatement();
                case 'try':
                    return parseTryStatement();
                case 'var':
                    return parseVariableStatement();
                case 'while':
                    return parseWhileStatement();
                case 'with':
                    return parseWithStatement();
                default:
                    break;
                }
            }

            expr = parseExpression();

            // 12.12 Labelled Statements
            if ((expr.type === Syntax.Identifier) && match(':')) {
                lex();

                if (Object.prototype.hasOwnProperty.call(state.labelSet, expr.name)) {
                    throwError({}, Messages.Redeclaration, 'Label', expr.name);
                }

                state.labelSet[expr.name] = true;
                labeledBody = parseStatement();
                delete state.labelSet[expr.name];

                return {
                    type: Syntax.LabeledStatement,
                    label: expr,
                    body: labeledBody
                };
            }

            consumeSemicolon();

            return {
                type: Syntax.ExpressionStatement,
                expression: expr
            };
        }

        // 13 Function Definition

        function parseFunctionSourceElements() {
            var sourceElement, sourceElements = [], token, directive, firstRestricted,
                oldLabelSet, oldInIteration, oldInSwitch, oldInFunctionBody;

            expect('{');

            while (index < length) {
                token = lookahead();
                if (token.type !== Token.StringLiteral) {
                    break;
                }

                sourceElement = parseSourceElement();
                sourceElements.push(sourceElement);
                if (sourceElement.expression.type !== Syntax.Literal) {
                    // this is not directive
                    break;
                }
                directive = sliceSource(token.range[0] + 1, token.range[1] - 1);
                if (directive === 'use strict') {
                    strict = true;
                    if (firstRestricted) {
                        throwError(firstRestricted, Messages.StrictOctalLiteral);
                    }
                } else {
                    if (!firstRestricted && token.octal) {
                        firstRestricted = token;
                    }
                }
            }

            oldLabelSet = state.labelSet;
            oldInIteration = state.inIteration;
            oldInSwitch = state.inSwitch;
            oldInFunctionBody = state.inFunctionBody;

            state.labelSet = {};
            state.inIteration = false;
            state.inSwitch = false;
            state.inFunctionBody = true;

            while (index < length) {
                if (match('}')) {
                    break;
                }
                sourceElement = parseSourceElement();
                if (typeof sourceElement === 'undefined') {
                    break;
                }
                sourceElements.push(sourceElement);
            }

            expect('}');

            state.labelSet = oldLabelSet;
            state.inIteration = oldInIteration;
            state.inSwitch = oldInSwitch;
            state.inFunctionBody = oldInFunctionBody;

            return {
                type: Syntax.BlockStatement,
                body: sourceElements
            };
        }

        function parseFunctionDeclaration() {
            var id, param, params = [], body, token, firstRestricted, message, previousStrict, paramSet;

            expectKeyword('function');
            token = lookahead();
            id = parseVariableIdentifier();
            if (strict) {
                if (isRestrictedWord(token.value)) {
                    throwError(token, Messages.StrictFunctionName);
                }
            } else {
                if (isRestrictedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictFunctionName;
                } else if (isStrictModeReservedWord(token.value)) {
                    firstRestricted = token;
                    message = Messages.StrictReservedWord;
                }
            }

            expect('(');

            if (!match(')')) {
                paramSet = {};
                while (index < length) {
                    token = lookahead();
                    param = parseVariableIdentifier();
                    if (strict) {
                        if (isRestrictedWord(token.value)) {
                            throwError(token, Messages.StrictParamName);
                        }
                        if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                            throwError(token, Messages.StrictParamDupe);
                        }
                    } else if (!firstRestricted) {
                        if (isRestrictedWord(token.value)) {
                            firstRestricted = token;
                            message = Messages.StrictParamName;
                        } else if (isStrictModeReservedWord(token.value)) {
                            firstRestricted = token;
                            message = Messages.StrictReservedWord;
                        } else if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                            firstRestricted = token;
                            message = Messages.StrictParamDupe;
                        }
                    }
                    params.push(param);
                    paramSet[param.name] = true;
                    if (match(')')) {
                        break;
                    }
                    expect(',');
                }
            }

            expect(')');

            previousStrict = strict;
            body = parseFunctionSourceElements();
            if (strict && firstRestricted) {
                throwError(firstRestricted, message);
            }
            strict = previousStrict;

            return {
                type: Syntax.FunctionDeclaration,
                id: id,
                params: params,
                defaults: [],
                body: body,
                rest: null,
                generator: false,
                expression: false
            };
        }

        function parseFunctionExpression() {
            var token, id = null, firstRestricted, message, param, params = [], body, previousStrict, paramSet;

            expectKeyword('function');

            if (!match('(')) {
                token = lookahead();
                id = parseVariableIdentifier();
                if (strict) {
                    if (isRestrictedWord(token.value)) {
                        throwError(token, Messages.StrictFunctionName);
                    }
                } else {
                    if (isRestrictedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictFunctionName;
                    } else if (isStrictModeReservedWord(token.value)) {
                        firstRestricted = token;
                        message = Messages.StrictReservedWord;
                    }
                }
            }

            expect('(');

            if (!match(')')) {
                paramSet = {};
                while (index < length) {
                    token = lookahead();
                    param = parseVariableIdentifier();
                    if (strict) {
                        if (isRestrictedWord(token.value)) {
                            throwError(token, Messages.StrictParamName);
                        }
                        if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                            throwError(token, Messages.StrictParamDupe);
                        }
                    } else if (!firstRestricted) {
                        if (isRestrictedWord(token.value)) {
                            firstRestricted = token;
                            message = Messages.StrictParamName;
                        } else if (isStrictModeReservedWord(token.value)) {
                            firstRestricted = token;
                            message = Messages.StrictReservedWord;
                        } else if (Object.prototype.hasOwnProperty.call(paramSet, token.value)) {
                            firstRestricted = token;
                            message = Messages.StrictParamDupe;
                        }
                    }
                    params.push(param);
                    paramSet[param.name] = true;
                    if (match(')')) {
                        break;
                    }
                    expect(',');
                }
            }

            expect(')');

            previousStrict = strict;
            body = parseFunctionSourceElements();
            if (strict && firstRestricted) {
                throwError(firstRestricted, message);
            }
            strict = previousStrict;

            return {
                type: Syntax.FunctionExpression,
                id: id,
                params: params,
                defaults: [],
                body: body,
                rest: null,
                generator: false,
                expression: false
            };
        }

        // 14 Program

        function parseSourceElement() {
            var token = lookahead();

            if (token.type === Token.Keyword) {
                switch (token.value) {
                case 'const':
                case 'let':
                    return parseConstLetDeclaration(token.value);
                case 'function':
                    return parseFunctionDeclaration();
                default:
                    return parseStatement();
                }
            }

            if (token.type !== Token.EOF) {
                return parseStatement();
            }
        }

        function parseSourceElements() {
            var sourceElement, sourceElements = [], token, directive, firstRestricted;

            while (index < length) {
                token = lookahead();
                if (token.type !== Token.StringLiteral) {
                    break;
                }

                sourceElement = parseSourceElement();
                sourceElements.push(sourceElement);
                if (sourceElement.expression.type !== Syntax.Literal) {
                    // this is not directive
                    break;
                }
                directive = sliceSource(token.range[0] + 1, token.range[1] - 1);
                if (directive === 'use strict') {
                    strict = true;
                    if (firstRestricted) {
                        throwError(firstRestricted, Messages.StrictOctalLiteral);
                    }
                } else {
                    if (!firstRestricted && token.octal) {
                        firstRestricted = token;
                    }
                }
            }

            while (index < length) {
                sourceElement = parseSourceElement();
                if (typeof sourceElement === 'undefined') {
                    break;
                }
                sourceElements.push(sourceElement);
            }
            return sourceElements;
        }

        function parseProgram() {
            var program;
            strict = false;
            program = {
                type: Syntax.Program,
                body: parseSourceElements()
            };
            return program;
        }

        // The following functions are needed only when the option to preserve
        // the comments is active.

        function addComment(type, value, start, end, loc) {
            assert(typeof start === 'number', 'Comment must have valid position');

            // Because the way the actual token is scanned, often the comments
            // (if any) are skipped twice during the lexical analysis.
            // Thus, we need to skip adding a comment if the comment array already
            // handled it.
            if (extra.comments.length > 0) {
                if (extra.comments[extra.comments.length - 1].range[1] > start) {
                    return;
                }
            }

            extra.comments.push({
                type: type,
                value: value,
                range: [start, end],
                loc: loc
            });
        }

        function scanComment() {
            var comment, ch, loc, start, blockComment, lineComment;

            comment = '';
            blockComment = false;
            lineComment = false;

            while (index < length) {
                ch = source[index];

                if (lineComment) {
                    ch = nextChar();
                    if (isLineTerminator(ch)) {
                        loc.end = {
                            line: lineNumber,
                            column: index - lineStart - 1
                        };
                        lineComment = false;
                        addComment('Line', comment, start, index - 1, loc);
                        if (ch === '\r' && source[index] === '\n') {
                            ++index;
                        }
                        ++lineNumber;
                        lineStart = index;
                        comment = '';
                    } else if (index >= length) {
                        lineComment = false;
                        comment += ch;
                        loc.end = {
                            line: lineNumber,
                            column: length - lineStart
                        };
                        addComment('Line', comment, start, length, loc);
                    } else {
                        comment += ch;
                    }
                } else if (blockComment) {
                    if (isLineTerminator(ch)) {
                        if (ch === '\r' && source[index + 1] === '\n') {
                            ++index;
                            comment += '\r\n';
                        } else {
                            comment += ch;
                        }
                        ++lineNumber;
                        ++index;
                        lineStart = index;
                        if (index >= length) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    } else {
                        ch = nextChar();
                        if (index >= length) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                        comment += ch;
                        if (ch === '*') {
                            ch = source[index];
                            if (ch === '/') {
                                comment = comment.substr(0, comment.length - 1);
                                blockComment = false;
                                ++index;
                                loc.end = {
                                    line: lineNumber,
                                    column: index - lineStart
                                };
                                addComment('Block', comment, start, index, loc);
                                comment = '';
                            }
                        }
                    }
                } else if (ch === '/') {
                    ch = source[index + 1];
                    if (ch === '/') {
                        loc = {
                            start: {
                                line: lineNumber,
                                column: index - lineStart
                            }
                        };
                        start = index;
                        index += 2;
                        lineComment = true;
                        if (index >= length) {
                            loc.end = {
                                line: lineNumber,
                                column: index - lineStart
                            };
                            lineComment = false;
                            addComment('Line', comment, start, index, loc);
                        }
                    } else if (ch === '*') {
                        start = index;
                        index += 2;
                        blockComment = true;
                        loc = {
                            start: {
                                line: lineNumber,
                                column: index - lineStart - 2
                            }
                        };
                        if (index >= length) {
                            throwError({}, Messages.UnexpectedToken, 'ILLEGAL');
                        }
                    } else {
                        break;
                    }
                } else if (isWhiteSpace(ch)) {
                    ++index;
                } else if (isLineTerminator(ch)) {
                    ++index;
                    if (ch ===  '\r' && source[index] === '\n') {
                        ++index;
                    }
                    ++lineNumber;
                    lineStart = index;
                } else {
                    break;
                }
            }
        }

        function filterCommentLocation() {
            var i, entry, comment, comments = [];

            for (i = 0; i < extra.comments.length; ++i) {
                entry = extra.comments[i];
                comment = {
                    type: entry.type,
                    value: entry.value
                };
                if (extra.range) {
                    comment.range = entry.range;
                }
                if (extra.loc) {
                    comment.loc = entry.loc;
                }
                comments.push(comment);
            }

            extra.comments = comments;
        }

        function collectToken() {
            var start, loc, token, range, value;

            skipComment();
            start = index;
            loc = {
                start: {
                    line: lineNumber,
                    column: index - lineStart
                }
            };

            token = extra.advance();
            loc.end = {
                line: lineNumber,
                column: index - lineStart
            };

            if (token.type !== Token.EOF) {
                range = [token.range[0], token.range[1]];
                value = sliceSource(token.range[0], token.range[1]);
                extra.tokens.push({
                    type: TokenName[token.type],
                    value: value,
                    range: range,
                    loc: loc
                });
            }

            return token;
        }

        function collectRegex() {
            var pos, loc, regex, token;

            skipComment();

            pos = index;
            loc = {
                start: {
                    line: lineNumber,
                    column: index - lineStart
                }
            };

            regex = extra.scanRegExp();
            loc.end = {
                line: lineNumber,
                column: index - lineStart
            };

            // Pop the previous token, which is likely '/' or '/='
            if (extra.tokens.length > 0) {
                token = extra.tokens[extra.tokens.length - 1];
                if (token.range[0] === pos && token.type === 'Punctuator') {
                    if (token.value === '/' || token.value === '/=') {
                        extra.tokens.pop();
                    }
                }
            }

            extra.tokens.push({
                type: 'RegularExpression',
                value: regex.literal,
                range: [pos, index],
                loc: loc
            });

            return regex;
        }

        function filterTokenLocation() {
            var i, entry, token, tokens = [];

            for (i = 0; i < extra.tokens.length; ++i) {
                entry = extra.tokens[i];
                token = {
                    type: entry.type,
                    value: entry.value
                };
                if (extra.range) {
                    token.range = entry.range;
                }
                if (extra.loc) {
                    token.loc = entry.loc;
                }
                tokens.push(token);
            }

            extra.tokens = tokens;
        }

        function createLiteral(token) {
            return {
                type: Syntax.Literal,
                value: token.value
            };
        }

        function createRawLiteral(token) {
            return {
                type: Syntax.Literal,
                value: token.value,
                raw: sliceSource(token.range[0], token.range[1])
            };
        }

        function wrapTrackingFunction(range, loc) {

            return function (parseFunction) {

                function isBinary(node) {
                    return node.type === Syntax.LogicalExpression ||
                        node.type === Syntax.BinaryExpression;
                }

                function visit(node) {
                    if (isBinary(node.left)) {
                        visit(node.left);
                    }
                    if (isBinary(node.right)) {
                        visit(node.right);
                    }

                    if (range && typeof node.range === 'undefined') {
                        node.range = [node.left.range[0], node.right.range[1]];
                    }
                    if (loc && typeof node.loc === 'undefined') {
                        node.loc = {
                            start: node.left.loc.start,
                            end: node.right.loc.end
                        };
                    }
                }

                return function () {
                    var node, rangeInfo, locInfo;

                    skipComment();
                    rangeInfo = [index, 0];
                    locInfo = {
                        start: {
                            line: lineNumber,
                            column: index - lineStart
                        }
                    };

                    node = parseFunction.apply(null, arguments);
                    if (typeof node !== 'undefined') {

                        if (range && typeof node.range === 'undefined') {
                            rangeInfo[1] = index;
                            node.range = rangeInfo;
                        }

                        if (loc && typeof node.loc === 'undefined') {
                            locInfo.end = {
                                line: lineNumber,
                                column: index - lineStart
                            };
                            node.loc = locInfo;
                        }

                        if (isBinary(node)) {
                            visit(node);
                        }

                        if (node.type === Syntax.MemberExpression) {
                            if (typeof node.object.range !== 'undefined') {
                                node.range[0] = node.object.range[0];
                            }
                            if (typeof node.object.loc !== 'undefined') {
                                node.loc.start = node.object.loc.start;
                            }
                        }

                        if (node.type === Syntax.CallExpression) {
                            if (typeof node.callee.range !== 'undefined') {
                                node.range[0] = node.callee.range[0];
                            }
                            if (typeof node.callee.loc !== 'undefined') {
                                node.loc.start = node.callee.loc.start;
                            }
                        }
                        return node;
                    }
                };

            };
        }

        function patch() {

            var wrapTracking;

            if (extra.comments) {
                extra.skipComment = skipComment;
                skipComment = scanComment;
            }

            if (extra.raw) {
                extra.createLiteral = createLiteral;
                createLiteral = createRawLiteral;
            }

            if (extra.range || extra.loc) {

                wrapTracking = wrapTrackingFunction(extra.range, extra.loc);

                extra.parseAdditiveExpression = parseAdditiveExpression;
                extra.parseAssignmentExpression = parseAssignmentExpression;
                extra.parseBitwiseANDExpression = parseBitwiseANDExpression;
                extra.parseBitwiseORExpression = parseBitwiseORExpression;
                extra.parseBitwiseXORExpression = parseBitwiseXORExpression;
                extra.parseBlock = parseBlock;
                extra.parseFunctionSourceElements = parseFunctionSourceElements;
                extra.parseCallMember = parseCallMember;
                extra.parseCatchClause = parseCatchClause;
                extra.parseComputedMember = parseComputedMember;
                extra.parseConditionalExpression = parseConditionalExpression;
                extra.parseConstLetDeclaration = parseConstLetDeclaration;
                extra.parseEqualityExpression = parseEqualityExpression;
                extra.parseExpression = parseExpression;
                extra.parseForVariableDeclaration = parseForVariableDeclaration;
                extra.parseFunctionDeclaration = parseFunctionDeclaration;
                extra.parseFunctionExpression = parseFunctionExpression;
                extra.parseLogicalANDExpression = parseLogicalANDExpression;
                extra.parseLogicalORExpression = parseLogicalORExpression;
                extra.parseMultiplicativeExpression = parseMultiplicativeExpression;
                extra.parseNewExpression = parseNewExpression;
                extra.parseNonComputedMember = parseNonComputedMember;
                extra.parseNonComputedProperty = parseNonComputedProperty;
                extra.parseObjectProperty = parseObjectProperty;
                extra.parseObjectPropertyKey = parseObjectPropertyKey;
                extra.parsePostfixExpression = parsePostfixExpression;
                extra.parsePrimaryExpression = parsePrimaryExpression;
                extra.parseProgram = parseProgram;
                extra.parsePropertyFunction = parsePropertyFunction;
                extra.parseRelationalExpression = parseRelationalExpression;
                extra.parseStatement = parseStatement;
                extra.parseShiftExpression = parseShiftExpression;
                extra.parseSwitchCase = parseSwitchCase;
                extra.parseUnaryExpression = parseUnaryExpression;
                extra.parseVariableDeclaration = parseVariableDeclaration;
                extra.parseVariableIdentifier = parseVariableIdentifier;

                parseAdditiveExpression = wrapTracking(extra.parseAdditiveExpression);
                parseAssignmentExpression = wrapTracking(extra.parseAssignmentExpression);
                parseBitwiseANDExpression = wrapTracking(extra.parseBitwiseANDExpression);
                parseBitwiseORExpression = wrapTracking(extra.parseBitwiseORExpression);
                parseBitwiseXORExpression = wrapTracking(extra.parseBitwiseXORExpression);
                parseBlock = wrapTracking(extra.parseBlock);
                parseFunctionSourceElements = wrapTracking(extra.parseFunctionSourceElements);
                parseCallMember = wrapTracking(extra.parseCallMember);
                parseCatchClause = wrapTracking(extra.parseCatchClause);
                parseComputedMember = wrapTracking(extra.parseComputedMember);
                parseConditionalExpression = wrapTracking(extra.parseConditionalExpression);
                parseConstLetDeclaration = wrapTracking(extra.parseConstLetDeclaration);
                parseEqualityExpression = wrapTracking(extra.parseEqualityExpression);
                parseExpression = wrapTracking(extra.parseExpression);
                parseForVariableDeclaration = wrapTracking(extra.parseForVariableDeclaration);
                parseFunctionDeclaration = wrapTracking(extra.parseFunctionDeclaration);
                parseFunctionExpression = wrapTracking(extra.parseFunctionExpression);
                parseLogicalANDExpression = wrapTracking(extra.parseLogicalANDExpression);
                parseLogicalORExpression = wrapTracking(extra.parseLogicalORExpression);
                parseMultiplicativeExpression = wrapTracking(extra.parseMultiplicativeExpression);
                parseNewExpression = wrapTracking(extra.parseNewExpression);
                parseNonComputedMember = wrapTracking(extra.parseNonComputedMember);
                parseNonComputedProperty = wrapTracking(extra.parseNonComputedProperty);
                parseObjectProperty = wrapTracking(extra.parseObjectProperty);
                parseObjectPropertyKey = wrapTracking(extra.parseObjectPropertyKey);
                parsePostfixExpression = wrapTracking(extra.parsePostfixExpression);
                parsePrimaryExpression = wrapTracking(extra.parsePrimaryExpression);
                parseProgram = wrapTracking(extra.parseProgram);
                parsePropertyFunction = wrapTracking(extra.parsePropertyFunction);
                parseRelationalExpression = wrapTracking(extra.parseRelationalExpression);
                parseStatement = wrapTracking(extra.parseStatement);
                parseShiftExpression = wrapTracking(extra.parseShiftExpression);
                parseSwitchCase = wrapTracking(extra.parseSwitchCase);
                parseUnaryExpression = wrapTracking(extra.parseUnaryExpression);
                parseVariableDeclaration = wrapTracking(extra.parseVariableDeclaration);
                parseVariableIdentifier = wrapTracking(extra.parseVariableIdentifier);
            }

            if (typeof extra.tokens !== 'undefined') {
                extra.advance = advance;
                extra.scanRegExp = scanRegExp;

                advance = collectToken;
                scanRegExp = collectRegex;
            }
        }

        function unpatch() {
            if (typeof extra.skipComment === 'function') {
                skipComment = extra.skipComment;
            }

            if (extra.raw) {
                createLiteral = extra.createLiteral;
            }

            if (extra.range || extra.loc) {
                parseAdditiveExpression = extra.parseAdditiveExpression;
                parseAssignmentExpression = extra.parseAssignmentExpression;
                parseBitwiseANDExpression = extra.parseBitwiseANDExpression;
                parseBitwiseORExpression = extra.parseBitwiseORExpression;
                parseBitwiseXORExpression = extra.parseBitwiseXORExpression;
                parseBlock = extra.parseBlock;
                parseFunctionSourceElements = extra.parseFunctionSourceElements;
                parseCallMember = extra.parseCallMember;
                parseCatchClause = extra.parseCatchClause;
                parseComputedMember = extra.parseComputedMember;
                parseConditionalExpression = extra.parseConditionalExpression;
                parseConstLetDeclaration = extra.parseConstLetDeclaration;
                parseEqualityExpression = extra.parseEqualityExpression;
                parseExpression = extra.parseExpression;
                parseForVariableDeclaration = extra.parseForVariableDeclaration;
                parseFunctionDeclaration = extra.parseFunctionDeclaration;
                parseFunctionExpression = extra.parseFunctionExpression;
                parseLogicalANDExpression = extra.parseLogicalANDExpression;
                parseLogicalORExpression = extra.parseLogicalORExpression;
                parseMultiplicativeExpression = extra.parseMultiplicativeExpression;
                parseNewExpression = extra.parseNewExpression;
                parseNonComputedMember = extra.parseNonComputedMember;
                parseNonComputedProperty = extra.parseNonComputedProperty;
                parseObjectProperty = extra.parseObjectProperty;
                parseObjectPropertyKey = extra.parseObjectPropertyKey;
                parsePrimaryExpression = extra.parsePrimaryExpression;
                parsePostfixExpression = extra.parsePostfixExpression;
                parseProgram = extra.parseProgram;
                parsePropertyFunction = extra.parsePropertyFunction;
                parseRelationalExpression = extra.parseRelationalExpression;
                parseStatement = extra.parseStatement;
                parseShiftExpression = extra.parseShiftExpression;
                parseSwitchCase = extra.parseSwitchCase;
                parseUnaryExpression = extra.parseUnaryExpression;
                parseVariableDeclaration = extra.parseVariableDeclaration;
                parseVariableIdentifier = extra.parseVariableIdentifier;
            }

            if (typeof extra.scanRegExp === 'function') {
                advance = extra.advance;
                scanRegExp = extra.scanRegExp;
            }
        }

        function stringToArray(str) {
            var length = str.length,
                result = [],
                i;
            for (i = 0; i < length; ++i) {
                result[i] = str.charAt(i);
            }
            return result;
        }

        function parse(code, options) {
            var program, toString;

            toString = String;
            if (typeof code !== 'string' && !(code instanceof String)) {
                code = toString(code);
            }

            source = code;
            index = 0;
            lineNumber = (source.length > 0) ? 1 : 0;
            lineStart = 0;
            length = source.length;
            buffer = null;
            state = {
                allowIn: true,
                labelSet: {},
                lastParenthesized: null,
                inFunctionBody: false,
                inIteration: false,
                inSwitch: false
            };

            extra = {};
            if (typeof options !== 'undefined') {
                extra.range = (typeof options.range === 'boolean') && options.range;
                extra.loc = (typeof options.loc === 'boolean') && options.loc;
                extra.raw = (typeof options.raw === 'boolean') && options.raw;
                if (typeof options.tokens === 'boolean' && options.tokens) {
                    extra.tokens = [];
                }
                if (typeof options.comment === 'boolean' && options.comment) {
                    extra.comments = [];
                }
                if (typeof options.tolerant === 'boolean' && options.tolerant) {
                    extra.errors = [];
                }
            }

            if (length > 0) {
                if (typeof source[0] === 'undefined') {
                    // Try first to convert to a string. This is good as fast path
                    // for old IE which understands string indexing for string
                    // literals only and not for string object.
                    if (code instanceof String) {
                        source = code.valueOf();
                    }

                    // Force accessing the characters via an array.
                    if (typeof source[0] === 'undefined') {
                        source = stringToArray(code);
                    }
                }
            }

            patch();
            try {
                program = parseProgram();
                if (typeof extra.comments !== 'undefined') {
                    filterCommentLocation();
                    program.comments = extra.comments;
                }
                if (typeof extra.tokens !== 'undefined') {
                    filterTokenLocation();
                    program.tokens = extra.tokens;
                }
                if (typeof extra.errors !== 'undefined') {
                    program.errors = extra.errors;
                }
            } catch (e) {
                throw e;
            } finally {
                unpatch();
                extra = {};
            }

            return program;
        }

        // Sync with package.json.
        exports.version = '1.0.0-dev';

        exports.parse = parse;

        // Deep copy.
        exports.Syntax = (function () {
            var name, types = {};

            if (typeof Object.create === 'function') {
                types = Object.create(null);
            }

            for (name in Syntax) {
                if (Syntax.hasOwnProperty(name)) {
                    types[name] = Syntax[name];
                }
            }

            if (typeof Object.freeze === 'function') {
                Object.freeze(types);
            }

            return types;
        }());

    })(esprima);
    
    var parseEx = function () {
        return esprima.parse.apply(esprima, arguments);
    };
    
    var Wind, _;
    
    var codeGenerator = (typeof eval("(function () {})") == "function") ?
        function (code) { return code; } :
        function (code) { return "false || " + code; };
        
    // support string type only.
    var stringify = (typeof JSON !== "undefined" && JSON.stringify) ?
        function (s) { return JSON.stringify(s); } :
        (function () {
            // Implementation comes from JSON2 (http://www.json.org/js.html)
        
            var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g;
            
            var meta = {    // table of character substitutions
                '\b': '\\b',
                '\t': '\\t',
                '\n': '\\n',
                '\f': '\\f',
                '\r': '\\r',
                '"' : '\\"',
                '\\': '\\\\'
            }
            
            return function (s) {
                // If the string contains no control characters, no quote characters, and no
                // backslash characters, then we can safely slap some quotes around it.
                // Otherwise we must also replace the offending characters with safe escape
                // sequences.

                escapable.lastIndex = 0;
                return escapable.test(s) ? '"' + s.replace(escapable, function (a) {
                    var c = meta[a];
                    return typeof c === 's' ? c :
                        '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                }) + '"' : '"' + s + '"';
            };
        })();
    
    function sprintf(format) {
        var args = arguments;
        return format.toString().replace(new RegExp("{\\d+}", "g"), function (p) {
            var n = parseInt(p.substring(1, p.length - 1), 10);
            return args[n + 1];
        });
    }
    
    function trim(s) {
        return s.replace(/ +/g, "");
    }

    function getPrecedence(ast) {
        var type = ast[0];
        switch (type) {
            case "dot": // .
            case "sub": // []
            case "call": // ()
                return 1;
            case "unary-postfix": // ++ -- - ~ ! delete new typeof void
            case "unary-prefix":
                return 2;
            case "var":
            case "binary":
                switch (ast[1]) {
                    case "*":
                    case "/":
                    case "%":
                        return 3;
                    case "+":
                    case "-":
                        return 4;
                    case "<<":
                    case ">>":
                    case ">>>":
                        return 5;
                    case "<":
                    case "<=":
                    case ">":
                    case ">=":
                    case "instanceof":
                        return 6;
                    case "==":
                    case "!=":
                    case "===":
                    case "!==":
                        return 7;
                    case "&":
                        return 8;
                    case "^":
                        return 9;
                    case "|":
                        return 10;
                    case "&&":
                        return 11;
                    case "||":
                        return 12;
                }
            case "conditional":
                return 13;
            case "assign":
                return 14;
            case "new":
                return 15;
            case "seq":
            case "stat":
            case "name":
            case "object":
            case "array":
            case "num":
            case "regexp":
            case "string":
            case "function":
            case "defun":
            case "for":
            case "for-in":
            case "block":
            case "while":
            case "do":
            case "if":
            case "break":
            case "continue":
            case "return":
            case "throw":
            case "try":
            case "switch": 
                return 0;
            default:
                return 100; // the lowest
        }
    }

    var CodeWriter = function (indent) {
        this._indent = indent || "    ";
        this._indentLevel = 0;
        
        this.lines = [];
    }
    CodeWriter.prototype = {
        write: function (str) {
            if (str === undefined) return;
            
            if (this.lines.length == 0) {
                this.lines.push("");
            }

            this.lines[this.lines.length - 1] += str;
            return this;
        },
        
        writeLine: function () {
            this.write.apply(this, arguments);
            this.lines.push("");
            return this;
        },
        
        writeIndents: function () {
            var indents = new Array(this._indentLevel);
            for (var i = 0; i < this._indentLevel; i++) {
                indents[i] = this._indent;
            }
            
            this.write(indents.join(""));
            return this;
        }, 
        
        addIndentLevel: function (diff) {
            this._indentLevel += diff;
            return this;
        }
    };
    
    var SeedProvider = function () {
        this._seeds = {};
    }
    SeedProvider.prototype.next = function (key) {
        var value = this._seeds[key];
        if (value == undefined) {
            this._seeds[key] = 0;
            return 0;
        } else {
            this._seeds[key] = ++value;
            return value;
        }
    }
    
    function isWindPattern(ast) {
        if (ast[0] != "call") return false;
        
        var evalName = ast[1];
        if (evalName[0] != "name" || evalName[1] != "eval") return false;

        var compileCall = ast[2][0];
        if (!compileCall || compileCall[0] != "call") return false;

        var compileMethod = compileCall[1];
        if (!compileMethod || compileMethod[0] != "dot" || compileMethod[2] != "compile") return false;

        var windName = compileMethod[1];
        if (!windName || windName[0] != "name" || windName[1] != compile.rootName) return false;

        var builder = compileCall[2][0];
        if (!builder || builder[0] != "string") return false;

        var func = compileCall[2][1];
        if (!func || func[0] != "function") return false;

        return true;
    }
    
    function compileWindPattern(ast, seedProvider, codeWriter, commentWriter) {

        var builderName = ast[2][0][2][0][1];
        var funcAst = ast[2][0][2][1];

        var windTreeGenerator = new WindTreeGenerator(builderName, seedProvider);
        var windAst = windTreeGenerator.generate(funcAst);

        commentWriter.write(builderName + " << ");
        var codeGenerator = new CodeGenerator(builderName, seedProvider, codeWriter, commentWriter);
        
        var funcName = funcAst[1] || "";
        codeGenerator.generate(funcName, funcAst[2], windAst);
        
        return funcName;
    }
        
    var WindTreeGenerator = function (builderName, seedProvider) {
        this._binder = Wind.binders[builderName];
        this._seedProvider = seedProvider;
    }
    WindTreeGenerator.prototype = {

        generate: function (ast) {

            var params = ast[2], statements = ast[3];

            var rootAst = { type: "delay", stmts: [] };

            this._visitStatements(statements, rootAst.stmts);

            return rootAst;
        },

        _getBindInfo: function (stmt) {

            var type = stmt[0];
            if (type == "stat") {
                var expr = stmt[1];
                if (expr[0] == "call") {
                    var callee = expr[1];
                    if (callee[0] == "name" && callee[1] == this._binder && expr[2].length == 1) {
                        return {
                            expression: expr[2][0],
                            argName: "",
                            assignee: null
                        };
                    }
                } else if (expr[0] == "assign") {
                    var assignee = expr[2];
                    expr = expr[3];
                    if (expr[0] == "call") {
                        var callee = expr[1];
                        if (callee[0] == "name" && callee[1] == this._binder && expr[2].length == 1) {
                            return {
                                expression: expr[2][0],
                                argName: "_result_$",
                                assignee: assignee
                            };
                        }
                    }
                }
            } else if (type == "var") {
                var defs = stmt[1];
                if (defs.length == 1) {
                    var item = defs[0];
                    var name = item[0];
                    var expr = item[1];
                    if (expr && expr[0] == "call") {
                        var callee = expr[1];
                        if (callee[0] == "name" && callee[1] == this._binder && expr[2].length == 1) {
                            return {
                                expression: expr[2][0],
                                argName: name,
                                assignee: null
                            };                            
                        }
                    }
                }
            } else if (type == "return") {
                var expr = stmt[1];
                if (expr && expr[0] == "call") {
                    var callee = expr[1];
                    if (callee[0] == "name" && callee[1] == this._binder && expr[2].length == 1) {
                        return {
                            expression: expr[2][0],
                            argName: "_result_$",
                            assignee: "return"
                        };
                    }
                }
            }

            return null;
        },

        _visitStatements: function (statements, stmts, index) {
            if (arguments.length <= 2) index = 0;

            if (index >= statements.length) {
                stmts.push({ type: "normal" });
                return this;
            }

            var currStmt = statements[index];
            var bindInfo = this._getBindInfo(currStmt);

            if (bindInfo) {
                var bindStmt = { type: "bind", info: bindInfo };
                stmts.push(bindStmt);

                if (bindInfo.assignee != "return") {
                    bindStmt.stmts = [];
                    this._visitStatements(statements, bindStmt.stmts, index + 1);
                }

            } else {
                var type = currStmt[0];
                if (type == "return" || type == "break" || type == "continue" || type == "throw") {

                    stmts.push({ type: type, stmt: currStmt });

                } else if (type == "if" || type == "try" || type == "for" || type == "do"
                           || type == "while" || type == "switch" || type == "for-in") {

                    var newStmt = this._visit(currStmt);

                    if (newStmt.type == "raw") {
                        stmts.push(newStmt);
                        this._visitStatements(statements, stmts, index + 1);
                    } else {
                        var isLast = (index == statements.length - 1);
                        if (isLast) {
                            stmts.push(newStmt);
                        } else {

                            var combineStmt = {
                                type: "combine",
                                first: { type: "delay", stmts: [newStmt] },
                                second: { type: "delay", stmts: [] }
                            };
                            stmts.push(combineStmt);

                            this._visitStatements(statements, combineStmt.second.stmts, index + 1);
                        }
                    }

                } else {

                    stmts.push({ type: "raw", stmt: currStmt });

                    this._visitStatements(statements, stmts, index + 1);
                }
            }

            return this;
        },

        _visit: function (ast) {

            var type = ast[0];

            function throwUnsupportedError() {
                throw new Error('"' + type + '" is not currently supported.');
            }

            var visitor = this._visitors[type];

            if (visitor) {
                return visitor.call(this, ast);
            } else {
                throwUnsupportedError();
            }
        },

        _visitBody: function (ast, stmts) {
            if (ast[0] == "block") {
                this._visitStatements(ast[1], stmts);
            } else {
                this._visitStatements([ast], stmts);
            }
        },

        _noBinding: function (stmts) {
            switch (stmts[stmts.length - 1].type) {
                case "normal":
                case "return":
                case "break":
                case "throw":
                case "continue":
                    return true;
            }

            return false;
        },

        _collectCaseStatements: function (cases, index) {
            var res = [];

            for (var i = index; i < cases.length; i++) {
                var rawStmts = cases[i][1];
                for (var j = 0; j < rawStmts.length; j++) {
                    if (rawStmts[j][0] == "break") {
                        return res
                    }

                    res.push(rawStmts[j]);
                }
            }

            return res;
        },

        _visitors: {

            "for": function (ast) {
                var bodyStmts = [];
                var body = ast[4];
                this._visitBody(body, bodyStmts);

                if (this._noBinding(bodyStmts)) {
                    return { type: "raw", stmt: ast };
                }
                
                var delayStmt = { type: "delay", stmts: [] };
                
                var setup = ast[1];
                if (setup) {
                    delayStmt.stmts.push({ type: "raw", stmt: setup });
                }
                
                var forStmt = { type: "for", bodyStmt: { type: "delay", stmts: bodyStmts } };
                delayStmt.stmts.push(forStmt);
                
                var condition = ast[2];
                if (condition) {
                    forStmt.condition = condition;
                }
                
                var update = ast[3];
                if (update) {
                    forStmt.update = update;
                }

                return delayStmt;
            },
            
            "for-in": function (ast) {

                var body = ast[4];
                
                var bodyStmts = [];
                this._visitBody(body, bodyStmts);

                if (this._noBinding(bodyStmts)) {
                    return { type: "raw", stmt: ast };
                }
                
                var forInStmt = { type: "for-in", bodyStmts: bodyStmts, obj: ast[3] };
            
                var argName = ast[2][1]; // ast[2] == ["name", m]
                if (ast[1][0] == "var") {
                    forInStmt.argName = argName;
                } else {
                    var keyVar = "_forInKey_$" + this._seedProvider.next("forInKey");
                    forInStmt.argName = keyVar;
                    forInStmt.bodyStmts.unshift({
                        type: "raw",
                        stmt: parse(argName + " = " + keyVar + ";")[1][0]
                    });
                }
            
                return forInStmt;
            },
        
            "while": function (ast) {

                var bodyStmts = [];
                var body = ast[2];
                this._visitBody(body, bodyStmts);

                if (this._noBinding(bodyStmts)) {
                    return { type: "raw", stmt: ast }
                }

                var loopStmt = { type: "while", bodyStmt: { type: "delay", stmts: bodyStmts } };

                var condition = ast[1];
                loopStmt.condition = condition;

                return loopStmt;
            },
            
            "do": function (ast) {

                var bodyStmts = [];
                var body = ast[2];
                this._visitBody(body, bodyStmts);

                if (this._noBinding(bodyStmts)) {
                    return { type: "raw", stmt: ast };
                }

                var doStmt = {
                    type: "do",
                    bodyStmt: { type: "delay", stmts: bodyStmts },
                    condition: ast[1]
                };

                return doStmt;
            },

            "switch": function (ast) {
                var noBinding = true;

                var switchStmt = { type: "switch", item: ast[1], caseStmts: [] };

                var cases = ast[2];
                for (var i = 0; i < cases.length; i++) {                    
                    var caseStmt = { item: cases[i][0], stmts: [] };
                    switchStmt.caseStmts.push(caseStmt);

                    var statements = this._collectCaseStatements(cases, i);
                    this._visitStatements(statements, caseStmt.stmts);
                    noBinding = noBinding && this._noBinding(caseStmt.stmts);
                }

                if (noBinding) {
                    return { type: "raw", stmt: ast };
                } else {
                    return switchStmt;
                }
            },

            "if": function (ast) {

                var noBinding = true;

                var ifStmt = { type: "if", conditionStmts: [] };

                var currAst = ast;
                while (true) {
                    var condition = currAst[1];
                    var condStmt = { cond: condition, stmts: [] };
                    ifStmt.conditionStmts.push(condStmt);

                    var thenPart = currAst[2];
                    this._visitBody(thenPart, condStmt.stmts);

                    noBinding = noBinding && this._noBinding(condStmt.stmts);

                    var elsePart = currAst[3];
                    if (elsePart && elsePart[0] == "if") {
                        currAst = elsePart;
                    } else {
                        break;
                    }
                }
    
                var elsePart = currAst[3];
                if (elsePart) {
                    ifStmt.elseStmts = [];

                    this._visitBody(elsePart, ifStmt.elseStmts);
                    
                    noBinding = noBinding && this._noBinding(ifStmt.elseStmts);
                }

                if (noBinding) {
                    return { type: "raw", stmt: ast };
                } else {
                    return ifStmt;
                }
            },

            "try": function (ast, stmts) {

                var bodyStmts = [];
                var bodyStatements = ast[1];
                this._visitStatements(bodyStatements, bodyStmts);

                var noBinding = this._noBinding(bodyStmts)

                var tryStmt = { type: "try", bodyStmt: { type: "delay", stmts: bodyStmts } };
                
                var catchClause = ast[2];
                if (catchClause) {
                    var exVar = catchClause[0];
                    tryStmt.exVar = exVar;
                    tryStmt.catchStmts = [];

                    this._visitStatements(catchClause[1], tryStmt.catchStmts);

                    noBinding = noBinding && this._noBinding(tryStmt.catchStmts);
                }

                var finallyStatements = ast[3];
                if (finallyStatements) {
                    tryStmt.finallyStmt = { type: "delay", stmts: [] };

                    this._visitStatements(finallyStatements, tryStmt.finallyStmt.stmts);

                    noBinding = noBinding && this._noBinding(tryStmt.finallyStmt.stmts);
                }

                if (noBinding) {
                    return { type: "raw", stmt: ast };
                } else {
                    return tryStmt;
                }
            }
        }
    }
    
    var CodeGenerator = function (builderName, seedProvider, codeWriter, commentWriter) {
        this._builderName = builderName;
        this._binder = Wind.binders[builderName];
        this._seedProvider = seedProvider;
        
        this._codeWriter = codeWriter;
        this._commentWriter = commentWriter;
    }
    CodeGenerator.prototype = {
    
        _code: function () {
            this._codeWriter.write.apply(this._codeWriter, arguments);
            return this;
        },
        
        _codeLine: function () {
            this._codeWriter.writeLine.apply(this._codeWriter, arguments);
            return this;
        },
        
        _codeIndents: function () {
            this._codeWriter.writeIndents();
            return this;
        },
        
        _codeIndentLevel: function (diff) {
            this._codeWriter.addIndentLevel(diff);
            return this;
        },
        
        _comment: function () {
            this._commentWriter.write.apply(this._commentWriter, arguments);
            return this;
        },
        
        _commentLine: function () {
            this._commentWriter.writeLine.apply(this._commentWriter, arguments);
            return this;
        },
        
        _commentIndents: function () {
            this._commentWriter.writeIndents();
            return this;
        },
        
        _commentIndentLevel: function (diff) {
            this._commentWriter.addIndentLevel(diff);
            return this;
        },
        
        _both: function () {
            this._codeWriter.write.apply(this._codeWriter, arguments);
            this._commentWriter.write.apply(this._commentWriter, arguments);

            return this;
        },
        
        _bothLine: function () {
            this._codeWriter.writeLine.apply(this._codeWriter, arguments);
            this._commentWriter.writeLine.apply(this._commentWriter, arguments);
            
            return this;
        },
        
        _bothIndents: function () {
            this._codeWriter.writeIndents();
            this._commentWriter.writeIndents();
            
            return this;
        },
        
        _bothIndentLevel: function (diff) {
            this._codeWriter.addIndentLevel(diff);
            this._commentWriter.addIndentLevel(diff);
            
            return this;
        },
        
        _newLine: function () {
            this._codeWriter.writeLine.apply(this._codeWriter, arguments);
            this._commentWriter.writeLine(); // To Remove
            return this;
        },
    
        generate: function (name, params, windAst) {
            this._normalMode = false;
            this._builderVar = "_builder_$" + this._seedProvider.next("builderId");
            
            this._codeLine("(function " + name + "(" + params.join(", ") + ") {")._commentLine("function (" + params.join(", ") + ") {");
            this._bothIndentLevel(1);

            this._codeIndents()._newLine("var " + this._builderVar + " = " + compile.rootName + ".builders[" + stringify(this._builderName) + "];");

            this._codeIndents()._newLine("return " + this._builderVar + ".Start(this,");
            this._codeIndentLevel(1);

            this._pos = { };

            this._bothIndents()._visitWind(windAst)._newLine();
            this._codeIndentLevel(-1);

            this._codeIndents()._newLine(");");
            this._bothIndentLevel(-1);

            this._bothIndents()._code("})")._comment("}");
        },

        _visitWind: function (ast) {
            this._windVisitors[ast.type].call(this, ast);
            return this;
        },

        _visitRaw: function (ast) {
            var type = ast[0];

            var visitor = this._rawVisitors[type];
            if (visitor) {
                visitor.call(this, ast);
            } else {
                throw new Error('"' + type + '" is not currently supported.');
            }

            return this;
        },

        _visitWindStatements: function (statements) {
            for (var i = 0; i < statements.length; i++) {
                var stmt = statements[i];

                if (stmt.type == "raw" || stmt.type == "if" || stmt.type == "switch") {
                    this._bothIndents()._visitWind(stmt)._newLine();
                } else if (stmt.type == "delay") {
                    this._visitWindStatements(stmt.stmts);
                } else {
                    this._bothIndents()._code("return ")._visitWind(stmt)._newLine(";");
                }
            }
        },

        _visitRawStatements: function (statements) {
            for (var i = 0; i < statements.length; i++) {
                var s = statements[i];

                this._bothIndents()._visitRaw(s)._bothLine();

                switch (s[0]) {
                    case "break":
                    case "return":
                    case "continue":
                    case "throw":
                        return;
                }
            }
        },

        _visitRawBody: function (body) {
            if (body[0] == "block") {
                this._visitRaw(body);
            } else {
                this._bothLine();
                this._bothIndentLevel(1);

                this._bothIndents()._visitRaw(body);
                this._bothIndentLevel(-1);
            }

            return this;
        },

        _visitRawFunction: function (ast) {
            var funcName = ast[1] || "";
            var args = ast[2];
            var statements = ast[3];
            
            this._bothLine("function " + funcName + "(" + args.join(", ") + ") {")
            this._bothIndentLevel(1);

            var currInFunction = this._pos.inFunction;
            this._pos.inFunction = true;

            this._visitRawStatements(statements);
            this._bothIndentLevel(-1);

            this._pos.inFunction = currInFunction;

            this._bothIndents()._both("}");
        },
        
        _windVisitors: {
            "delay": function (ast) {
                if (ast.stmts.length == 1) {
                    var subStmt = ast.stmts[0];
                    switch (subStmt.type) {
                        case "delay":
                        case "combine":
                        case "normal":
                        case "break":
                        case "continue":
                        case "for":
                        case "for-in":
                        case "while":
                        case "do":
                        case "try":
                            this._visitWind(subStmt);
                            return;
                        case "return":
                            if (!subStmt.stmt[1]) {
                                this._visitWind(subStmt);
                                return;
                            }
                    }
                }

                this._newLine(this._builderVar + ".Delay(function () {");
                this._codeIndentLevel(1);

                this._visitWindStatements(ast.stmts);
                this._codeIndentLevel(-1);

                this._codeIndents()._code("})");
            },

            "combine": function (ast) {
                this._newLine(this._builderVar + ".Combine(");
                this._codeIndentLevel(1);

                this._bothIndents()._visitWind(ast.first)._newLine(",");
                this._bothIndents()._visitWind(ast.second)._newLine();
                this._codeIndentLevel(-1);

                this._codeIndents()._code(")");
            },
            
            "for": function (ast) {                
                if (ast.condition) {
                    this._codeLine(this._builderVar + ".For(function () {")
                        ._commentLine("for (");
                    this._codeIndentLevel(1);
                    
                    this._bothIndents()
                        ._code("return ")
                        ._comment("; ")
                            ._visitRaw(ast.condition)
                                ._newLine(";");
                    this._codeIndentLevel(-1);
                    
                    this._bothIndents()._code("}, ");
                } else {
                    this._code(this._builderVar + ".For(null, ")
                        ._comment("for (; ");
                }
                
                if (ast.update) {
                    this._newLine("function () {");
                    this._codeIndentLevel(1);
                    
                    this._bothIndents()
                        ._comment("; ")
                            ._visitRaw(ast.update)
                                ._codeLine(";")
                                ._commentLine(") {");
                    this._codeIndentLevel(-1);
                    
                    this._codeIndents()._newLine("},");
                } else {
                    this._codeLine("null,")._commentLine("; ) {");
                }
                this._bothIndentLevel(1);
                
                this._bothIndents()._visitWind(ast.bodyStmt)._newLine();
                this._bothIndentLevel(-1);
                
                this._bothIndents()._code(")")._comment("}");
            },
            
            "for-in": function (ast) {
                this._code(this._builderVar + ".ForIn(")
                    ._comment("for (var " + ast.argName + " in ")
                        ._visitRaw(ast.obj)
                            ._codeLine(", function (" + ast.argName + ") {")
                            ._commentLine(") {");
                this._bothIndentLevel(1);
                
                this._visitWindStatements(ast.bodyStmts);
                this._bothIndentLevel(-1);
                
                this._bothIndents()._code("})")._comment("}");
            },
            
            "while": function (ast) {
                this._newLine(this._builderVar + ".While(function () {");
                this._codeIndentLevel(1);
                
                this._bothIndents()
                    ._code("return ")
                    ._comment("while (")
                        ._visitRaw(ast.condition)
                            ._codeLine(";")
                            ._commentLine(") {");
                this._codeIndentLevel(-1);
                
                this._codeIndents()._newLine("},");
                this._bothIndentLevel(1);
                
                this._bothIndents()._visitWind(ast.bodyStmt)._newLine();
                this._bothIndentLevel(-1);
                
                this._bothIndents()._code(")")._comment("}");
            },
            
            "do": function (ast) {
                this._codeLine(this._builderVar + ".Do(")._commentLine("do {");
                this._bothIndentLevel(1);
                
                this._bothIndents()._visitWind(ast.bodyStmt)._newLine(",");
                this._commentIndentLevel(-1);
                
                this._codeIndents()._newLine("function () {");
                this._codeIndentLevel(1);
                
                this._bothIndents()
                    ._code("return ")
                    ._comment("} while (")
                        ._visitRaw(ast.condition)
                            ._codeLine(";")
                            ._commentLine(");");
                this._codeIndentLevel(-1);
                
                this._codeIndents()._newLine("}");
                this._codeIndentLevel(-1);
                
                this._codeIndents()._code(")");
            },

            "raw": function (ast) {
                this._visitRaw(ast.stmt, true);
            },

            "bind": function (ast) {
                var info = ast.info;
                
                var commentPrefix = "";
                if (info.assignee == "return") {
                    commentPrefix = "return ";
                } else if (info.argName != "") {
                    commentPrefix = "var " + info.argName + " = ";
                }
                
                this._code(this._builderVar + ".Bind(")._comment(commentPrefix + this._binder + "(")._visitRaw(info.expression)._comment(");")._newLine(", function (" + info.argName + ") {");
                this._codeIndentLevel(1);

                if (info.assignee == "return") {
                    this._codeIndents()
                        ._newLine("return " + this._builderVar + ".Return(" + info.argName + ");");
                } else {
                    if (info.assignee) {
                        this._bothIndents()
                            ._visitRaw(info.assignee)._bothLine(" = " + info.argName + ";");
                    }

                    this._visitWindStatements(ast.stmts);
                }
                this._codeIndentLevel(-1);

                this._codeIndents()
                    ._code("})");
            },

            "if": function (ast) {

                for (var i = 0; i < ast.conditionStmts.length; i++) {
                    var stmt = ast.conditionStmts[i];
                    
                    this._both("if (")._visitRaw(stmt.cond)._bothLine(") {");
                    this._bothIndentLevel(1);

                    this._visitWindStatements(stmt.stmts);
                    this._bothIndentLevel(-1);

                    if (i < ast.conditionStmts.length - 1 || ast.elseStmts) {
                        this._bothIndents()._both("} else ");
                    } else {
                        this._bothIndents()._code("} else ")._comment("}");
                    }
                }

                if (ast.elseStmts) {
                    this._bothLine("{");
                    this._bothIndentLevel(1);
                } else {
                    this._newLine("{");
                    this._codeIndentLevel(1);
                }

                if (ast.elseStmts) {
                    this._visitWindStatements(ast.elseStmts);
                } else {
                    this._codeIndents()
                        ._newLine("return " + this._builderVar + ".Normal();");
                }

                if (ast.elseStmts) {
                    this._bothIndentLevel(-1);
                } else {
                    this._codeIndentLevel(-1);
                }

                if (ast.elseStmts) {
                    this._bothIndents()
                        ._both("}");
                } else {
                    this._codeIndents()
                        ._code("}");
                }
            },

            "switch": function (ast) {
                this._both("switch (")._visitRaw(ast.item)._bothLine(") {");
                this._bothIndentLevel(1);

                for (var i = 0; i < ast.caseStmts.length; i++) {
                    var caseStmt = ast.caseStmts[i];
                    
                    if (caseStmt.item) {
                        this._bothIndents()
                            ._both("case ")._visitRaw(caseStmt.item)._bothLine(":");
                    } else {
                        this._bothIndents()._bothLine("default:");
                    }
                    this._bothIndentLevel(1);

                    this._visitWindStatements(caseStmt.stmts);                    
                    this._bothIndentLevel(-1);
                }

                this._bothIndents()._code("}");
            },

            "try": function (ast) {
                this._codeLine(this._builderVar + ".Try(")._commentLine("try {");
                this._bothIndentLevel(1);

                this._bothIndents()._visitWind(ast.bodyStmt)._newLine(",");
                this._commentIndentLevel(-1);
                
                if (ast.catchStmts) {
                    this._bothIndents()
                        ._codeLine("function (" + ast.exVar + ") {")
                        ._commentLine("} catch (" + ast.exVar + ") {");
                    this._bothIndentLevel(1);

                    this._visitWindStatements(ast.catchStmts);
                    this._bothIndentLevel(-1);

                    this._bothIndents()._codeLine("},");
                    if (ast.finallyStmt) {
                        this._commentLine("} finally {");
                    } else {
                        this._commentLine("}");
                    }
                } else {
                    this._bothIndents()._codeLine("null,")._commentLine("} finally {");
                }
                
                if (ast.finallyStmt) {
                    this._commentIndentLevel(1);
                    this._bothIndents()._visitWind(ast.finallyStmt)._newLine();
                    this._commentIndentLevel(-1);
                } else {
                    this._codeIndents()._newLine("null");
                }
                this._codeIndentLevel(-1);
                
                this._codeIndents()._code(")");
                if (ast.finallyStmt) {
                    this._commentIndents()._comment("}");
                }
            },

            "normal": function (ast) {
                this._code(this._builderVar + ".Normal()");
            },

            "throw": function (ast) {
                this
                    ._code(this._builderVar + ".Throw(")
                    ._comment("throw ")
                        ._visitRaw(ast.stmt[1])
                            ._code(")")._comment(";");
            },

            "break": function (ast) {
                this._code(this._builderVar + ".Break()")._comment("break;");
            },

            "continue": function (ast) {
                this._code(this._builderVar + ".Continue()")._comment("continue;");
            },

            "return": function (ast) {
                this._code(this._builderVar + ".Return(")._comment("return");
                if (ast.stmt[1]) {
                    this._comment(" ")._visitRaw(ast.stmt[1]);
                }
                
                this._code(")")._comment(";");
            }
        },

        _rawVisitors: {
            "var": function (ast) {
                this._both("var ");

                var items = ast[1];
                for (var i = 0; i < items.length; i++) {
                    this._both(items[i][0]);
                    if (items[i].length > 1) {
                        this._both(" = ")._visitRaw(items[i][1]);
                    }
                    if (i < items.length - 1) this._both(", ");
                }

                this._both(";");
            },

            "seq": function (ast, noBracket) {
                var left = ast[1];
                var right = ast[2];
                
                if (!noBracket) this._both("(");
                
                this._visitRaw(left);
                this._both(", ");
                
                if (right[0] == "seq") {
                    arguments.callee.call(this, right, true);
                } else {
                    this._visitRaw(right);
                }
                
                if (!noBracket) this._both(")");
            },

            "binary": function (ast) {
                var op = ast[1], left = ast[2], right = ast[3];

                if (getPrecedence(ast) < getPrecedence(left)) {
                    this._both("(")._visitRaw(left)._both(") ");
                } else {
                    this._visitRaw(left)._both(" ");
                }

                this._both(op);

                if (getPrecedence(ast) <= getPrecedence(right)) {
                    this._both(" (")._visitRaw(right)._both(")");
                } else {
                    this._both(" ")._visitRaw(right);
                }
            },

            "sub": function (ast) {
                var prop = ast[1], index = ast[2];

                if (getPrecedence(ast) < getPrecedence(prop)) {
                    this._both("(")._visitRaw(prop)._both(")[")._visitRaw(index)._both("]");
                } else {
                    this._visitRaw(prop)._both("[")._visitRaw(index)._both("]");
                }
            },

            "unary-postfix": function (ast) {
                var op = ast[1];
                var item = ast[2];
                
                if (getPrecedence(ast) <= getPrecedence(item)) {
                    this._both("(")._visitRaw(item)._both(")");
                } else {
                    this._visitRaw(item);
                }
                
                this._both(" " + op);
            },

            "unary-prefix": function (ast) {
                var op = ast[1];
                var item = ast[2];
                
                this._both(op + " ");
                
                if (getPrecedence(ast) < getPrecedence(item)) {
                    this._both("(")._visitRaw(item)._both(")");
                } else {
                    this._visitRaw(item);
                }
            },

            "assign": function (ast) {
                var op = ast[1];
                var name = ast[2];
                var value = ast[3];
                
                if (name[0] == "assign") {
                    this._both("(")._visitRaw(name)._both(")");
                } else {
                    this._visitRaw(name);
                }
                
                if ((typeof op) == "string") {
                    this._both(" " + op + "= ");
                } else {
                    this._both(" = ");
                }
                
                this._visitRaw(value);
            },

            "stat": function (ast) {
                this._visitRaw(ast[1])._both(";");
            },

            "dot": function (ast) {
                var left = ast[1];
                var right = ast[2];
                
                if (getPrecedence(ast) < getPrecedence(left)) {
                    this._both("(")._visitRaw(left)._both(").")._both(right);
                } else {
                    this._visitRaw(left)._both(".")._both(right);
                }
            },

            "new": function (ast) {
                var ctor = ast[1];

                this._both("new ")._visitRaw(ctor)._both("(");

                var args = ast[2];
                for (var i = 0, len = args.length; i < len; i++) {
                    this._visitRaw(args[i]);
                    if (i < len - 1) this._both(", ");
                }

                this._both(")");
            },

            "call": function (ast) {
            
                if (isWindPattern(ast)) {
                    compileWindPattern(ast, this._seedProvider, this._codeWriter, this._commentWriter);
                } else {
                    var caller = ast[1];
                
                    var invalidBind = (caller[0] == "name") && (caller[1] == this._binder);
                    // throw?

                    if (getPrecedence(ast) < getPrecedence(caller)) {
                        this._both("(")._visitRaw(caller)._both(")");
                    } else {
                        this._visitRaw(caller);
                    }
                    
                    this._both("(");

                    var args = ast[2];
                    for (var i = 0; i < args.length; i++) {
                        this._visitRaw(args[i]);
                        if (i < args.length - 1) this._both(", ");
                    }

                    this._both(")");
                }
            },

            "name": function (ast) {
                this._both(ast[1]);
            },

            "object": function (ast) {
                var items = ast[1];
                if (items.length <= 0) {
                    this._both("{ }");
                } else {
                    this._bothLine("{");
                    this._bothIndentLevel(1);
                    
                    for (var i = 0; i < items.length; i++) {
                        this._bothIndents()
                            ._both(stringify(items[i][0]) + ": ")
                            ._visitRaw(items[i][1]);
                        
                        if (i < items.length - 1) {
                            this._bothLine(",");
                        } else {
                            this._bothLine("");
                        }
                    }
                    
                    this._bothIndentLevel(-1);
                    this._bothIndents()._both("}");
                }
            },

            "array": function (ast) {
                this._both("[");

                var items = ast[1];
                for (var i = 0; i < items.length; i++) {
                    this._visitRaw(items[i]);
                    if (i < items.length - 1) this._both(", ");
                }

                this._both("]");
            },

            "num": function (ast) {
                this._both(ast[1]);
            },

            "regexp": function (ast) {
                this._both("/" + ast[1] + "/" + ast[2]);
            },

            "string": function (ast) {
                this._both(stringify(ast[1]));
            },

            "function": function (ast) {
                this._visitRawFunction(ast);
            },

            "defun": function (ast) {
                this._visitRawFunction(ast);
            },
            
            "for": function (ast) {
                this._both("for (");

                var setup = ast[1];
                if (setup) {
                    this._visitRaw(setup);
                    if (setup[0] != "var") {
                        this._both("; ");
                    } else {
                        this._both(" ");
                    }
                } else {
                    this._both("; ");
                }

                var condition = ast[2];
                if (condition) this._visitRaw(condition);
                this._both("; ");

                var update = ast[3];
                if (update) this._visitRaw(update);
                this._both(") ");

                var currInLoop = this._pos.inLoop;
                this._pos.inLoop = true;

                var body = ast[4];
                this._visitRawBody(body);

                this._pos.inLoop = currInLoop;
            },

            "for-in": function (ast) {
                this._both("for (");

                var declare = ast[1];
                if (declare[0] == "var") { // declare == ["var", [["m"]]]
                    this._both("var " + declare[1][0][0]);
                } else {
                    this._visitRaw(declare);
                }
                
                this._both(" in ")._visitRaw(ast[3])._both(") ");

                var body = ast[4];
                this._visitRawBody(body);
            },

            "block": function (ast) {
                if (ast.length > 1) {            
                    this._bothLine("{")
                    this._bothIndentLevel(1);

                    this._visitRawStatements(ast[1]);
                    this._bothIndentLevel(-1);

                    this._bothIndents()
                        ._both("}");
                } else {
                    this._both(";");
                }
            },

            "while": function (ast) {
                var condition = ast[1];
                var body = ast[2];

                var currInLoop = this._pos.inLoop;
                this._pos.inLoop = true;

                this._both("while (")._visitRaw(condition)._both(") ")._visitRawBody(body);

                this._pos.inLoop = currInLoop;
            },

            "do": function (ast) {
                var condition = ast[1];
                var body = ast[2];

                var currInLoop = this._pos.inLoop;
                this._pos.inLoop = true;

                this._both("do ")._visitRawBody(body);

                this._pos.inLoop = currInLoop;

                if (body[0] == "block") {
                    this._both(" ");
                } else {
                    this._bothLine()
                        ._bothIndents();
                }

                this._both("while (")._visitRaw(condition)._both(");");
            },

            "if": function (ast) {
                var condition = ast[1];
                var thenPart = ast[2];

                this._both("if (")._visitRaw(condition)._both(") ")._visitRawBody(thenPart);

                var elsePart = ast[3];
                if (elsePart) {
                    if (thenPart[0] == "block") {
                        this._both(" ");
                    } else {
                        this._bothLine("")
                            ._bothIndents();
                    }

                    if (elsePart[0] == "if") {
                        this._both("else ")._visitRaw(elsePart);
                    } else {
                        this._both("else ")._visitRawBody(elsePart);
                    }
                }
            },

            "break": function (ast) {
                if (this._pos.inLoop || this._pos.inSwitch) {
                    this._both("break;");
                } else {
                    this._code("return ")._visitWind({ type: "break", stmt: ast })._code(";");
                }
            },

            "continue": function (ast) {
                if (this._pos.inLoop) {
                    this._both("continue;");
                } else {
                    this._code("return ")._visitWind({ type: "continue", stmt: ast })._code(";");
                }
            },

            "return": function (ast) {
                if (this._pos.inFunction) {
                    this._both("return");
                    var value = ast[1];
                    if (value) this._both(" ")._visitRaw(value);
                    this._both(";");
                } else {
                    this._code("return ")._visitWind({ type: "return", stmt: ast })._code(";");
                }
            },

            "throw": function (ast) {
                var pos = this._pos;
                if (pos.inTry || pos.inFunction) {
                    this._both("throw ")._visitRaw(ast[1])._both(";");
                } else {
                    this._code("return ")._visitWind({ type: "throw", stmt: ast })._code(";");
                }
            },

            "conditional": function (ast) {
                this._both("(")._visitRaw(ast[1])._both(") ? (")._visitRaw(ast[2])._both(") : (")._visitRaw(ast[3])._both(")");
            },

            "try": function (ast) {

                this._bothLine("try {");
                this._bothIndentLevel(1);

                var currInTry = this._pos.inTry;
                this._pos.inTry = true;

                this._visitRawStatements(ast[1]);
                this._bothIndentLevel(-1);

                this._pos.inTry = currInTry;

                var catchClause = ast[2];
                var finallyStatements = ast[3];

                if (catchClause) {
                    this._bothIndents()
                        ._bothLine("} catch (" + catchClause[0] + ") {")
                    this._bothIndentLevel(1);

                    this._visitRawStatements(catchClause[1]);
                    this._bothIndentLevel(-1);
                }

                if (finallyStatements) {
                    this._bothIndents()
                        ._bothLine("} finally {");
                    this._bothIndentLevel(1);

                    this._visitRawStatements(finallyStatements);
                    this._bothIndentLevel(-1);
                }                

                this._bothIndents()
                    ._both("}");
            },

            "switch": function (ast) {
                this._both("switch (")._visitRaw(ast[1])._bothLine(") {");
                this._bothIndentLevel(1);

                var currInSwitch = this._pos.inSwitch;
                this._pos.inSwitch = true;

                var cases = ast[2];
                for (var i = 0; i < cases.length; i++) {
                    var c = cases[i];
                    this._bothIndents();

                    if (c[0]) {
                        this._both("case ")._visitRaw(c[0])._bothLine(":");
                    } else {
                        this._bothLine("default:");
                    }
                    this._bothIndentLevel(1);

                    this._visitRawStatements(c[1]);
                    this._bothIndentLevel(-1);
                }
                this._bothIndentLevel(-1);

                this._pos.inSwitch = currInSwitch;

                this._bothIndents()
                    ._both("}");
            }
        }
    };
    
    var merge = function (commentLines, codeLines) {
        var length = commentLines.length;
        
        var maxShift = 0;
        
        for (var i = 0; i < length; i++) {
            var matches = codeLines[i].match(" +");
            var spaceLength = matches ? matches[0].length : 0;
            
            var shift = commentLines[i].length - spaceLength + 10;
            if (shift > maxShift) {
                maxShift = shift;
            }
        }
        
        var shiftBuffer = new Array(maxShift);
        for (var i = 0; i < maxShift; i++) {
            shiftBuffer[i] = " ";
        }
        
        var shiftSpaces = shiftBuffer.join("");

        var buffer = [];
        for (var i = 0; i < length; i++) {
            var comment = commentLines[i]; 
            if (comment.replace(/ +/g, "").length > 0) {
                comment = "/* " + comment + " */   ";
            }
            
            var code = shiftSpaces + codeLines[i];
            
            buffer.push(comment);
            buffer.push(code.substring(comment.length));
            
            if (i != length - 1) {
                buffer.push("\n");
            }
        }
        
        return buffer.join("");
    }
    
    var sourceUrlSeed = 0;
    
    var getSourceUrlPostfix = function (funcName) {
        return "\r\n//@ sourceURL=wind/" + (sourceUrlSeed++) + "_" + (funcName || "anonymous") + ".js";
    }
    
    var load = function (data, name, defaultValue) {
        if (!data) return defaultValue;
        
        if (data.hasOwnProperty(name)) {
            return data[name];
        }
        
        return defaultValue;
    }
    
    var ProgramCompiler = function (options) {
        this._options = options;
    }
    ProgramCompiler.prototype = {

    };
    
    var compile = function (builderName, func, options) {

        var funcCode = func.toString();
        var evalCode = "eval(" + load(options, "root", "Wind") + ".compile(" + stringify(builderName) + ", " + funcCode + "))"
        var evalCodeAst = parse(evalCode);

        var codeWriter = new CodeWriter();
        var commentWriter = new CodeWriter();
        
        // [ "toplevel", [ [ "stat", [ "call", ... ] ] ] ]
        var evalAst = evalCodeAst[1][0][1];
        var funcName = compileWindPattern(evalAst, new SeedProvider(), codeWriter, commentWriter);
        
        var newCode = merge(commentWriter.lines, codeWriter.lines);
        if (!load(options, "noSourceUrl", false)) {
            newCode += getSourceUrlPostfix(funcName);
        }
        
        if (!load(options, "noLogging", false)) {
            Wind.logger.debug("// Original: \r\n" + funcCode + "\r\n\r\n// Compiled: \r\n" + newCode + "\r\n");
        }
        
        return codeGenerator(newCode);
    }

    var compileBlock = function (block) {
        var blockCode = block.toString();
        
        var beginIndex = blockCode.indexOf("{");
        var endIndex = blockCode.lastIndexOf("}");
        
        var programCode = blockCode.substring(beginIndex + 1, endIndex);
        var compiledCode = compileProgram(programCode);
        
        var outputCode = compiledCode + getSourceUrlPostfix();
        console.log(outputCode);
        return outputCode;
    }

    var compileProgram = function (code) {

        var isSubset = function (full, partial) {
            if (full === partial) return true;
            
            if (typeof full !== typeof partial) return false
            switch (typeof full) {
                case "string":
                case "number":
                case "boolean":
                case "undefined":
                    return full === partial;
            }
            
            if (full === null && partial !== null) return false;
            if (full !== null && partial === null) return false;

            if (_.isArray(full)) {
                if (!_.isArray(partial)) return false;
                if (full.length != partial.length) return false;

                for (var i = 0; i < full.length; i++) {
                    if (!isSubset(full[i], partial[i])) return false;
                }

                return true;
            }
            
            if (_.isArray(partial)) return false;
            
            var result = _.each(partial, function (key, value) {
                if (!(key in full)) return false;
                if (!isSubset(full[key], value)) return false;
            });
            
            if (result === false) return false
            
            return true;
        };

        var extract = function (codeAst) {
            var results = [];

            var windPattern = {
                "type": "CallExpression",
                "callee": { "type": "Identifier", "name": "eval" },
                "arguments": [ {
                    "type": "CallExpression",
                    "callee": {
                        "type": "MemberExpression",
                        "computed": false,
                        "object": { "type": "Identifier", "name": "Wind" },
                        "property": { "type": "Identifier", "name": "compile" }
                    },
                    "arguments": [ { "type": "Literal" }, { "type": "FunctionExpression" } ]
                } ]
            };

            var tryExtractWindMethod = function (ast) {
                if (!isSubset(ast, windPattern)) return false;

                var builderName = ast.arguments[0].arguments[0].value;
                if (typeof builderName !== "string") return false;
                    
                results.push({
                    builderName: builderName,
                    patternRange: ast.range,
                    funcRange: ast.arguments[0].arguments[1].range
                });

                return true;
            };

            var visitAll = function (array) {
                for (var i = 0; i < array.length; i++) {
                    visit(array[i]);
                }
            };
            
            var visit = function (ast) {
                switch (ast.type) {
                    case "Program":
                    case "BlockStatement":
                        visitAll(ast.body);
                        break;
                    case "ExpressionStatement":
                        visit(ast.expression);
                        break;
                    case "MemberExpression":
                        visit(ast.object);
                        visit(ast.property);
                        break;
                    case "BinaryExpression":
                    case "AssignmentExpression":
                    case "LogicalExpression":
                        visit(ast.left);
                        visit(ast.right);
                        break;
                    case "VariableDeclarator":
                        if (ast.init) visit(ast.init);
                        break;
                    case "VariableDeclaration":
                        visitAll(ast.declarations);
                        break;
                    case "ReturnStatement":
                        if (ast.argument) visit(ast.argument);
                        break;
                    case "UnaryExpression":
                    case "ThrowStatement":
                        visit(ast.argument);
                        break;
                    case "NewExpression":
                        visit(ast.callee);
                        visitAll(ast.arguments);
                        break;
                    case "ConditionalExpression":
                        visit(ast.test);
                        visit(ast.consequent);
                        visit(ast.alternate);
                        break;
                    case "IfStatement":
                        visit(ast.test);
                        visit(ast.consequent);
                        if (ast.alternate) visit(ast.alternate);
                        break;
                    case "ObjectExpression":
                        visitAll(ast.properties);
                        break;
                    case "Property":
                        visit(ast.value);
                        break;
                    case "ArrayExpression":
                        visitAll(ast.elements);
                        break;
                    case "ForStatement":
                        if (ast.init) visit(ast.init);
                        if (ast.test) visit(ast.test);
                        if (ast.update) visit(ast.update);
                        visit(ast.body);
                        break;
                    case "ForInStatement":
                        visit(ast.right);
                        visit(ast.body);
                        break;
                    case "CallExpression":
                        if (!tryExtractWindMethod(ast)) {
                            visit(ast.callee);
                            visitAll(ast.arguments);
                        }
                        break;
                    case "TryStatement":
                        visit(ast.block);
                        visitAll(ast.handlers);
                        if (ast.finalizer) visit(ast.finalizer);
                        break;
                    case "CatchClause":
                    case "FunctionExpression":
                    case "FunctionDeclaration":
                    case "LabeledStatement":
                        visit(ast.body);
                        break;
                    case "WhileStatement":
                    case "DoWhileStatement":
                        visit(ast.test);
                        visit(ast.body);
                        break;
                    case "SequenceExpression":
                        visitAll(ast.expressions);
                        break;
                    case "SwitchStatement":
                        visit(ast.discriminant);
                        visitAll(ast.cases);
                        break;
                    case "SwitchCase":
                        if (ast.test) visit(ast.test);
                        visitAll(ast.consequent);
                        break;
                    case "WithStatement":
                        visit(ast.object);
                        visit(ast.body);
                        break;
                    case "Identifier":
                    case "Literal":
                    case "UpdateExpression":
                    case "ThisExpression":
                    case "ContinueStatement":
                    case "BreakStatement":
                    case "EmptyStatement":
                    case "DebuggerStatement":
                        break;
                    default:
                        console.log(ast);
                        throw ast.type;
                }
            };
            
            visit(codeAst);
            
            return results;
        };

        function generateCode(inputCode, results) {
            var codeParts = [];
            var lastIndex = 0;

            for (var i = 0; i < results.length; i++) {
                var item = results[i],
                    patternRange = item.patternRange,
                    funcRange = item.funcRange;
                
                var originalCode = inputCode.substring(funcRange[0], funcRange[1]);
                var compiledCode = Wind.compile(item.builderName, originalCode, { noSourceUrl: true, noLogging: true });
                
                codeParts.push(inputCode.substring(lastIndex, patternRange[0]));
                codeParts.push(compiledCode);
                lastIndex = patternRange[1];
            }

            if (lastIndex < inputCode.length) {
                codeParts.push(inputCode.substring(lastIndex));
            }
            
            return codeParts.join("");
        }

        var codeAst = parseEx(code, { range: true });
        var results = extract(codeAst);
        return generateCode(code, results);
    }

    compile.rootName = "Wind";

    // CommonJS
    var isCommonJS = !!(typeof require === "function" && typeof module !== "undefined" && module.exports);
    // CommonJS AMD
    var isAmd = !!(typeof require === "function" && typeof define === "function" && define.amd);

    var defineModule = function () {
        Wind.define({
            name: "compiler",
            version: "0.7.1",
            require: isCommonJS && require,
            dependencies: { core: "~0.7.0" },
            init: function () {
                _ = Wind._;

                Wind.parse = parse;
                Wind.parseEx = parseEx;
                Wind.compile = compile;
                Wind.compileBlock = compileBlock;
                Wind.compileProgram = compileProgram;
            }
        });
    }

    if (isCommonJS) {
        try {
            Wind = require("./wind-core");
        } catch (ex) {
            Wind = require("wind-core");
        }
        
        defineModule();
    } else if (isAmd) {
        require(["wind-core"], function (wind) {
            Wind = wind;
            defineModule();
        });
    } else {
        var Fn = Function, global = Fn('return this')();
        if (!global.Wind) {
            throw new Error('Missing the root object, please load "wind" component first.');
        }
        
        Wind = global.Wind;
        defineModule();
    }
})();
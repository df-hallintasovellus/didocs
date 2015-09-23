var fs = require("fs");
var path = require("path");

/**
 * Checks if a token is an identifier.
 * @param {string} identifier - Identifier to validate.
 * @returns {boolean} Whether the token is a valid identifier.
 */
function isIdentifier(token) {
    return typeof token === "string" &&
        [ "function", "var" ].indexOf(token) === -1;
}

/**
 * Finds the next identifier declared in the code.
 * @param {string} code - Code to analyse.
 * @returns {string} Next identifier found in the code.
 */
function getFirstIdentifier(code) {
    return code.match(/\w+/g).reduce(function(found, token) {
        return found ? found : isIdentifier(token) ? token : undefined
    }, undefined);
}

/**
 * A block of documentation.
 * @param {string} commentBlock - Block of source documentation.
 * @param {string} codeBlock - Block of source code.
 */
function Doc(commentBlock, codeBlock) {
    this.identifier = getFirstIdentifier(codeBlock);
    this.indentation = commentBlock.match(/^\s*(\*\s*)/)[0].length;
    commentBlock
        .split("\n")
        .map(function(line) {
            return line.slice(this.indentation);
        }, this)
        .filter(function(comment) {
            return comment.trim().length > 0;
        })
        .reduce(function(comments, comment) {
            if (comment.charAt(0) === "@")
                comments.push(comment);
            else
                comments.push(comments.pop() + " " + comment);
            return comments;
        }, [ "@brief" ])
        .forEach(function(comment) {
            var command = comment.match(/\w+/)[0];
            this[command](comment.slice(1 + command.length).trim());
        }, this);
}

/**
 * Adds a brief description of the function.
 */
Doc.prototype.brief = function(brief) {
    this.brief = brief;
}

/**
 * Adds a method parameter description.
 */
Doc.prototype.param = function(line) {
    if (!this.params)
        this.params = [];
    var type = line.match(/^\{(.+)\}\s*/);
    if (type !== null) {
        line = line.slice(type[0].length);
        type = type[1].trim();
        var name = line.match(/^(\w+)\s*(-\s*)?/);
        if (name !== null) {
            line = line.slice(name[0].length);
            var name = name[1];
        }
    }
    var brief = line.trim();
    this.params.push({
        brief: brief,
        name: name,
        type: type
    });
}

/**
 * Adds a return type description.
 */
Doc.prototype.returns = function(line) {
    var type = line.match(/^\{(.+)\}/);
    if (type !== null) {
        line = line.slice(type[0].length);
        type = type[1].trim();
    }
    var brief = line.trim();
    this.returns = {
        brief: brief,
        type: type
    };
}

/**
 * Runs the parser on a file.
 * @param {string} file - Path to the file.
 */
function parseFile(filename, callback) {
    fs.readFile(filename, "utf8", function(err, data) {
        if (err) return callback(err);
        callback(null, (" " + data)
            .split("/**\n")
            .filter(function(el, i) {
                return i % 2;
            })
            .map(function(el, i) {
                var blocks = el.split("*/").slice(0, 2);
                if (blocks !== null)
                    return new Doc(blocks[0], blocks[1]);
            })
        );
    });
}

/**
 * Converts a source code file to an HTML doc page.
 * @param {string} filename - Path to the file to convert.
 * @param {string} docPath - Path to the target directory.
 */
function processFile(filename, docPath) {
    parseFile(filename, function(err, doc) {
        if (err) throw err;
        fs.writeFile(
            path.join(docPath, filename + ".html"),
            JSON.stringify(doc),
            "utf8",
            function(err) {
                if (err) throw err;
            }
        );
    });
}

fs.mkdir("doc", function(err) {
    if (err && err.code !== "EEXIST") throw err;
    processFile("didocs.js", "doc");
});

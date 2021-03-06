// Generated by CoffeeScript 1.8.0
(function() {
  var Connection, clarinet, debug, defer, net, pubsub,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  debug = require('debug')('xbmc:TCPConnection');

  pubsub = require('./PubSub');

  defer = require('node-promise').defer;

  clarinet = require('clarinet');

  net = require('net');

  Connection = (function() {
    function Connection(options) {
      var _base, _base1, _base2, _base3, _base4, _base5;
      this.options = options != null ? options : {};
      this._receive = __bind(this._receive, this);
      this._createParser = __bind(this._createParser, this);
      this.onData = __bind(this.onData, this);
      this.onClose = __bind(this.onClose, this);
      this.onError = __bind(this.onError, this);
      this.onOpen = __bind(this.onOpen, this);
      this.publish = __bind(this.publish, this);
      this.close = __bind(this.close, this);
      this.send = __bind(this.send, this);
      this.isActive = __bind(this.isActive, this);
      this.create = __bind(this.create, this);
      debug('constructor', this.options);
      if ((_base = this.options).port == null) {
        _base.port = 9090;
      }
      if ((_base1 = this.options).host == null) {
        _base1.host = '127.0.0.1';
      }
      if ((_base2 = this.options).user == null) {
        _base2.user = 'xbmc';
      }
      if ((_base3 = this.options).password == null) {
        _base3.password = false;
      }
      if ((_base4 = this.options).verbose == null) {
        _base4.verbose = false;
      }
      if ((_base5 = this.options).connectNow == null) {
        _base5.connectNow = true;
      }
      this._createParser();
      this.sendQueue = [];
      this.deferreds = {};
      if (this.options.connectNow) {
        this.create();
      }
    }

    Connection.prototype.create = function() {
      debug('create');
      this.socket = net.connect({
        host: this.options.host,
        port: this.options.port
      });
      this.socket.on('connect', this.onOpen);
      this.socket.on('data', this.onData);
      this.socket.on('error', this.onError);
      this.socket.on('disconnect', this.onClose);
      return this.socket.on('close', this.onClose);
    };

    Connection._id = 0;

    Connection.generateId = function() {
      return "__id" + (++Connection._id);
    };

    Connection.prototype.isActive = function() {
      var _ref;
      debug('isActive');
      return ((_ref = this.socket) != null ? _ref._connecting : void 0) === false;
    };

    Connection.prototype.send = function(data) {
      var dfd, _base, _name;
      if (data == null) {
        data = null;
      }
      debug('send', JSON.stringify(data));
      if (!data) {
        throw new Error('Connection: Unknown arguments');
      }
      if (data.id == null) {
        data.id = Connection.generateId();
      }
      dfd = (_base = this.deferreds)[_name = data.id] != null ? _base[_name] : _base[_name] = defer();
      if (!this.isActive()) {
        this.sendQueue.push(data);
      } else {
        data.jsonrpc = '2.0';
        data = JSON.stringify(data);
        this.publish('send', data);
        this.socket.write(data);
      }
      return dfd.promise;
    };

    Connection.prototype.close = function(fn) {
      var err;
      if (fn == null) {
        fn = null;
      }
      debug('close');
      try {
        this.socket.end();
        this.socket.destroy();
        if (fn) {
          return fn();
        }
      } catch (_error) {
        err = _error;
        this.publish('error', err);
        if (fn) {
          return fn(err);
        }
      }
    };

    Connection.prototype.publish = function(topic, data) {
      var dataVerbose;
      if (data == null) {
        data = {};
      }
      dataVerbose = typeof data === 'object' ? JSON.stringify(data) : data;
      debug('publish', topic, dataVerbose);
      return pubsub.emit("connection:" + topic, data);
    };

    Connection.prototype.onOpen = function() {
      debug('onOpen');
      this.publish('open');
      return setTimeout(((function(_this) {
        return function() {
          var item, _i, _len, _ref;
          _ref = _this.sendQueue;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            item = _ref[_i];
            _this.send(item);
          }
          return _this.sendQueue = [];
        };
      })(this)), 500);
    };

    Connection.prototype.onError = function(evt) {
      debug('onError', JSON.stringify(evt));
      return this.publish('error', evt);
    };

    Connection.prototype.onClose = function(evt) {
      debug('onClose', evt);
      this.publish('close', evt);
      return this.parser.close();
    };

    Connection.prototype.onData = function(buffer) {
      debug('onData');
      return this.parser.write(buffer.toString());
    };

    Connection.prototype._createParser = function() {
      var addValue, currentKey, stack;
      this.parser = clarinet.parser();
      stack = [];
      currentKey = null;
      addValue = (function(_this) {
        return function(val) {
          if (Array.isArray(stack[0])) {
            return stack[0].push(val);
          } else {
            return stack[0][currentKey] = val;
          }
        };
      })(this);
      this.parser.onerror = (function(_this) {
        return function(ex) {
          throw new Error("JSON parse error: " + ex);
        };
      })(this);
      this.parser.onvalue = (function(_this) {
        return function(val) {
          return addValue(val);
        };
      })(this);
      this.parser.onopenobject = (function(_this) {
        return function(key) {
          var obj;
          obj = {};
          if (stack.length) {
            addValue(obj);
          }
          stack.unshift(obj);
          return currentKey = key;
        };
      })(this);
      this.parser.onkey = (function(_this) {
        return function(key) {
          return currentKey = key;
        };
      })(this);
      this.parser.oncloseobject = (function(_this) {
        return function() {
          var obj;
          obj = stack.shift();
          if (stack.length === 0) {
            return _this._receive(obj);
          }
        };
      })(this);
      this.parser.onopenarray = (function(_this) {
        return function() {
          var arr;
          arr = [];
          if (stack.length) {
            addValue(arr);
          }
          return stack.unshift(arr);
        };
      })(this);
      this.parser.onclosearray = (function(_this) {
        return function() {
          return stack.shift();
        };
      })(this);
      return this.parser.onend = (function(_this) {
        return function() {};
      })(this);
    };

    Connection.prototype._receive = function(data) {
      var dfd, evt, id, _ref, _ref1;
      evt = {
        data: data
      };
      id = (_ref = evt.data) != null ? _ref.id : void 0;
      dfd = this.deferreds[id];
      delete this.deferreds[id];
      if (evt.data.error) {
        this.onError(evt);
        if (dfd) {
          return dfd.reject(evt.data);
        }
      } else {
        this.publish('data', evt.data);
        if ((_ref1 = evt.data.method) != null ? _ref1.indexOf('.On' > 1) : void 0) {
          this.publish('notification', evt.data);
        }
        if (dfd) {
          return dfd.resolve(evt.data);
        }
      }
    };

    return Connection;

  })();

  module.exports = Connection;

}).call(this);

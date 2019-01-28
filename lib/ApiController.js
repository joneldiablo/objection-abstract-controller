'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Model class which extends from ObjectionJS Model. 
 * Instance generated using **`Model.query()`**
 * @typedef {Class} Model
 */

/**
 * @class Controller
 * @abstract
 * @description All controllers must extends from this class.
 * @author Jonathan Diego Rodríguez Rdz. <jonathan@bquate.com>
 * @param {Class} Model - model class to use,
 * this param is required and must be a **ObjectionJS Model class**.
 * @param {string[]} [qcolumns=[]] - Query columns: array of column names
 * to use as the searchable columns, 
 * the Model must have **`Model.jsonSchema.search`** array 
 * but could rewrite it with this parameter 
 * (the **`Model.jsonSchema.search`** its a custom variable).
 */
var ApiController = function () {

  /**
   * Alias for the *this* object.
   * @memberof Controller
   * @instance
   * @inner
   * @name c
   */
  function ApiController(Model) {
    var qcolumns = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    _classCallCheck(this, ApiController);

    var c = this;
    c.Model = Model;
    c.qcolumns = Model.jsonSchema.search || qcolumns;
  }

  /**
   * Make an Object to response with data array 
   * which list the filtered rows by the searchable columns 
   * using OR conditionals to retrieve the data with pagination 
   * and total rows.
   * @param {Object} req - Request: The req object represents the HTTP request, its a *Express* parameter.
   * @param {Object} res - Response: The res object represents the HTTP response that an Express app sends when it gets an HTTP request.
   * @param {Function} next - Next: Express function to continue to the next middleware.
   * @param {Model} [modelObject] - Model object: if it's necessary modify, filter or join data, 
   * the child classes can set this parameter to modify the request using any Objection method, 
   * e.g. **`Model.query().eager(...)`**.
   * @param {boolean} [promise] - Let decide if the method respond as service or as promise
   */


  _createClass(ApiController, [{
    key: 'get',
    value: function get(req, res, next, modelObject, promise) {
      var c = this;

      //pagination
      var limit = parseInt(req.query.limit || 20);
      var offset = parseInt(req.query.offset || (req.query.page || 0) * req.query.limit);
      var fieldsReq = typeof req.query.fields === 'string';
      var fields = new Set();
      if (fieldsReq) {
        fieldsReq = req.query.fields.split(',');
        fieldsReq.forEach(function (f) {
          return fields.add(f);
        });
      }
      if (req.query.q || !fieldsReq) {
        c.qcolumns.forEach(function (f) {
          return fields.add(f);
        });
      }

      if (!modelObject) {
        modelObject = c.Model.query().select('id', Array.from(fields));
        //clear any search
        //modelObject.clear(/.*/).clearSelect().select('id', ...c.qcolumns);
      }
      //omni search
      if (req.query.q) {
        var query = req.query.q;
        var columns = c.qcolumns.slice(0);
        var firstColumn = columns.pop();
        // ordering template
        var locateOrder = 'CASE WHEN {{column}} = \'' + query + '\' THEN 0  \n                             WHEN {{column}} LIKE \'' + query + '%\' THEN 1 \n                             ELSE 3\n                           END';
        var regexColumn = /\{\{column\}\}/g;
        var order = [locateOrder.replace(regexColumn, firstColumn)];
        // filter by *q* parametter
        modelObject.where(function (builder) {
          var pullSearch = builder.where(firstColumn, 'like', '%' + query + '%');
          columns.map(function (column) {
            pullSearch.orWhere(column, 'like', '%' + query + '%');
            order.push(locateOrder.replace(regexColumn, column));
          });
        });
        // set order string builded
        modelObject.orderByRaw(order.join(', '));
      }
      //FIX: use .page() from objection, generate all of this code, and do only one call
      //get data with pagination
      var response = Promise.all([modelObject.resultSize(), modelObject.offset(offset).limit(limit)]).then(function (resp) {
        return {
          total: resp[0],
          data: resp[1],
          limit: limit,
          offset: offset || 0,
          page: Math.trunc(offset / limit) || 0
        };
      });
      if (promise) {
        return response;
      } else {
        response.then(function (resp) {
          return c.success(req, res, next, resp);
        }).catch(function (resp) {
          return c.catch(res, resp);
        });
      }
    }

    /**
     * List the elements with status 1
     * @param {Object} req - Express
     * @param {Object} res - Express
     * @param {Function} next - Express
     * @param {Model} [modelObject] - Objection promise
     * @param {boolean} [promise] - Let decide if the method respond as service or as promise
     */

  }, {
    key: 'getActive',
    value: function getActive(req, res, next, modelObject, promise) {
      var c = this;
      if (!modelObject) {
        modelObject = c.Model.query();
      }
      var response = c.get(req, res, next, modelObject.where('status', true), true);
      if (promise) {
        return response;
      } else {
        response.then(function (resp) {
          return c.success(req, res, next, resp);
        }).catch(function (resp) {
          return c.catch(res, resp);
        });
      }
    }

    /**
     * Search one element by id and send it as response, the parameters are the same as get method
     * @param {Object} req - Express
     * @param {Object} res - Express
     * @param {Function} next - Express
     * @param {Model} [modelObject] - Objection promise
     * @param {boolean} [promise] - Let decide if the method respond as service or as promise
     */

  }, {
    key: 'getByID',
    value: function getByID(req, res, next, modelObject, promise) {
      var c = this;
      if (!modelObject) {
        modelObject = c.Model.query();
        //clear any search
        //modelObject.clear(/.*/).clearSelect();
      }

      var response = modelObject.findById(req.params.ID);
      if (promise) {
        return response;
      } else {
        response.then(function (row) {
          if (!row) throw {
            statusCode: 404,
            description: 'not found'
          };
          return c.success(req, res, next, {
            row: row
          });
        }).catch(function (resp) {
          return c.catch(res, resp);
        });
      }
    }

    /**
     * Search one element by any column and send it as response, the parameters are the same as get method
     * @param {Object} req - Express
     * @param {Object} res - Express
     * @param {Function} next - Express
     * @param {Model} [modelObject] - Objection promise
     * @param {boolean} [promise] - Let decide if the method respond as service or as promise
     */

  }, {
    key: 'getByColumn',
    value: function getByColumn(req, res, next, modelObject, promise) {
      var c = this;
      if (!modelObject) {
        modelObject = c.Model.query();
        //clear any search
        //modelObject.clear(/.*/).clearSelect();
      }

      var response = modelObject.findOne(req.query);
      if (promise) {
        return response;
      } else {
        response.then(function (row) {
          if (!row) throw {
            statusCode: 404,
            description: 'not found'
          };
          return c.success(req, res, next, {
            row: row
          });
        }).catch(function (resp) {
          return c.catch(res, resp);
        });
      }
    }

    /**
     * Create new row in database, the parameters are the same as get method
     * @param {Object} req - Express
     * @param {Object} res - Express
     * @param {Function} next - Express
     * @param {Model} [modelObject] - Objection promise
     * @param {boolean} [promise] - Let decide if the method respond as service or as promise
     */

  }, {
    key: 'set',
    value: function set(req, res, next, modelObject, promise) {
      var c = this;
      if (!modelObject) {
        modelObject = c.Model.query();
        //clear any search
        //modelObject.clear(/.*/).clearSelect();
      }
      var response = modelObject.insertWithRelated(req.body);
      if (promise) {
        return response;
      } else {
        response.then(function (resp) {
          return c.success(req, res, next, {
            id: resp.id
          });
        }).catch(function (resp) {
          return c.catch(res, resp);
        });
      }
    }

    /**
     * Modify a row in database, the parameters are the same as get method
     * @param {Object} req - Express
     * @param {Object} res - Express
     * @param {Function} next - Express
     * @param {Model} [modelObject] - Objection promise
     * @param {boolean} [promise] - Let decide if the method respond as service or as promise
     */

  }, {
    key: 'update',
    value: function update(req, res, next, modelObject, promise) {
      var c = this;
      if (!modelObject) {
        modelObject = c.Model.query();
        //clear any search
        //modelObject.clear(/.*/).clearSelect();
      }
      req.body.id = parseInt(req.params.ID) || req.params.ID;
      var response = modelObject.upsertGraph(req.body);
      if (promise) {
        return response;
      } else {
        response.then(function (resp) {
          return c.success(req, res, next, {
            id: resp.id
          });
        }).catch(function (resp) {
          return c.catch(res, resp);
        });
      }
    }

    /**
     * Delete a row in database. [Question]: modify to only set status 0? the parameters are the same as get method
     * @param {Object} req - Express
     * @param {Object} res - Express
     * @param {Function} next - Express
     * @param {Model} [modelObject] - Objection promise
     * @param {boolean} [promise] - Let decide if the method respond as service or as promise
     */

  }, {
    key: 'delete',
    value: function _delete(req, res, next, modelObject, promise) {
      var c = this;
      if (!modelObject) {
        modelObject = c.Model.query();
        //clear any search
        //modelObject.clear(/.*/).clearSelect();
      }
      var response = modelObject.deleteById(req.params.ID);
      if (promise) {
        return response;
      } else {
        response.then(function (resp) {
          return c.success(req, res, next, resp);
        }).catch(function (resp) {
          return c.catch(res, resp);
        });
      }
    }

    /**
     * This method is not really protected but the idea is use only by the children, if everything is ok, the data pass by this method and is filtered by the permission function
     * @protected
     * @param {Object} req - Express
     * @param {Object} res - Express 
     * @param {Function} next - Express 
     * @param {Object} resp - Data response
     * @param {Number} [status=200] - The status code with which will respond the request
     */

  }, {
    key: 'success',
    value: function success(req, res, next, resp) {
      var status = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : 200;

      var response = {
        status: status,
        success: true
      };
      if ((typeof resp === 'undefined' ? 'undefined' : _typeof(resp)) === 'object' && !Array.isArray(resp)) {
        Object.assign(response, resp);
      } else {
        response.description = resp;
      }
      /*
       * FIX: when public services is trying to use this the permission its undefined,
       * create a middleware for public routes and create a permission object, meave create an anonymus user role to
       */
      if (req.user && req.user.permission) {
        if (response.row) {
          response.row = req.user.permission.filter(response.row);
        } else if (response.data) {
          response.data = req.user.permission.filter(response.data);
        }
      }
      res.status(response.status).json(response);
    }

    /**
     * This method is not really protected but the idea is use only by children, if any error is thrown this function catch it
     * @protected
     * @param {Object} res - Response: From Express
     * @param {Object} resp - Error data response 
     * @param {Number} [status=500] - The status code with which will respond the request
     */

  }, {
    key: 'catch',
    value: function _catch(res, resp) {
      var status = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 500;

      console.log('Error: ', resp);
      var response = {
        status: resp.statusCode || status,
        error: true,
        errorDescription: resp
      };
      delete resp.statusCode;
      delete resp.sql;
      res.status(response.status).json(response);
    }

    /**
     * Abstract method for be override
     * @abstract
     * @param {Object} data - The request data, process before send to data base
     */

  }, {
    key: 'processData',
    value: function processData(data) {
      throw 'abstract method, override';
    }
  }]);

  return ApiController;
}();

module.exports = ApiController;
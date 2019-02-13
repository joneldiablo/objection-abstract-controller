// lib to convert "{'q.column':value}" to "{q:{column:value}}"
const unflatten = require('flat').unflatten;

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
 * this param is required and must be an **ObjectionJS Model class**.
 * @param {string[]} [qcolumns=[]] - Query columns: array of column names
 * to use as the searchable columns, 
 * the Model must have **`Model.jsonSchema.search`** array 
 * but could be rewrited with this parameter 
 * (the **`Model.jsonSchema.search`** its a custom variable).
 */
class ApiController {

  /**
   * Alias for the *this* object.
   * @memberof Controller
   * @instance
   * @inner
   * @name c
   */
  constructor(Model, qcolumns = []) {
    let c = this;
    c.Model = Model;
    c.qcolumns = (Model.jsonSchema || {}).search || qcolumns;
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
  get(req, res, next, modelObject, promise) {
    let c = this;
    req.query = unflatten(req.query);

    // pagination
    let limit = parseInt(req.query.limit || 20);
    let offset = parseInt(req.query.offset || (req.query.page || 0) * req.query.limit);
    let page = req.query.page || Math.trunc(offset / limit) || 0;
    // fields or columns to return by row
    let fieldsReq = typeof req.query.fields === 'string';
    let queryByColumns = typeof req.query.q === 'object';
    let fields = new Set();

    if (fieldsReq) {
      fieldsReq = req.query.fields.split(',');
      fieldsReq.forEach(f => fields.add(f.trim()));
    }

    if (queryByColumns) {
      Object.keys(req.query.q).forEach(f => fields.add(f));
    }

    if (req.query.q || !fieldsReq) {
      c.qcolumns.forEach(f => fields.add(f));
    }

    if (!modelObject) {
      if (!fields.size) {
        fields.add('*');
      } else {
        fields.add('id');
      }
      let finalFields = Array.from(fields);
      modelObject = c.Model.query().select(finalFields);
      //clear any search
      //modelObject.clear(/.*/).clearSelect().select('id', ...c.qcolumns);
    }

    // omni search
    if (typeof req.query.q === 'string') {
      let query = req.query.q;
      let columns = c.qcolumns.slice(0);
      let firstColumn = columns.pop();
      // ordering template
      const locateOrder = `CASE WHEN {{column}} = '${query}' THEN 0  
                             WHEN {{column}} LIKE '${query}%' THEN 1 
                             ELSE 3
                           END`;
      const regexColumn = /\{\{column\}\}/g;
      let order = [locateOrder.replace(regexColumn, firstColumn)];
      // filter by *q* parametter
      modelObject.where(builder => {
        let pullSearch = builder.where(firstColumn, 'like', `%${query}%`);
        columns.map(column => {
          pullSearch.orWhere(column, 'like', `%${query}%`);
          order.push(locateOrder.replace(regexColumn, column));
        });
      });
      // set order string builded
      modelObject.orderByRaw(order.join(', '));
    }

    // search by column
    if (queryByColumns) {
      modelObject.where(builder => {
        Object.keys(req.query.q).forEach(col => {
          builder.where(col, 'like', `%${req.query.q[col]}%`);
        });
      });
    }

    //get data with pagination
    let response = modelObject.page(page, limit)
      .then(resp => ({
        total: resp.total,
        data: resp.results,
        limit: limit,
        offset: offset || 0,
        page: page
      }))
    if (promise) {
      return response;
    } else {
      response
        .then(resp => c.success(req, res, next, resp))
        .catch(resp => c.catch(res, resp));
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
  getActive(req, res, next, modelObject, promise) {
    let c = this;
    if (!modelObject) {
      modelObject = c.Model.query();
    }
    let response = c.get(req, res, next, modelObject.where('status', true), true);
    if (promise) {
      return response;
    } else {
      response
        .then(resp => c.success(req, res, next, resp))
        .catch(resp => c.catch(res, resp));
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
  getByID(req, res, next, modelObject, promise) {
    let c = this;
    if (!modelObject) {
      modelObject = c.Model.query();
      //clear any search
      //modelObject.clear(/.*/).clearSelect();
    }

    let response = modelObject
      .findById(req.params.ID);
    if (promise) {
      return response;
    } else {
      response
        .then(row => {
          if (!row) throw {
            statusCode: 404,
            description: 'not found'
          }
          return c.success(req, res, next, {
            row
          });
        })
        .catch(resp => c.catch(res, resp));
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
  getByColumn(req, res, next, modelObject, promise) {
    let c = this;
    if (!modelObject) {
      modelObject = c.Model.query();
      //clear any search
      //modelObject.clear(/.*/).clearSelect();
    }

    let response = modelObject
      .findOne(req.query);
    if (promise) {
      return response;
    } else {
      response
        .then(row => {
          if (!row) throw {
            statusCode: 404,
            description: 'not found'
          }
          return c.success(req, res, next, {
            row
          });
        })
        .catch(resp => c.catch(res, resp));
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
  set(req, res, next, modelObject, promise) {
    let c = this;
    if (!modelObject) {
      modelObject = c.Model.query();
      //clear any search
      //modelObject.clear(/.*/).clearSelect();
    }
    let response = modelObject
      .insertWithRelated(req.body);
    if (promise) {
      return response;
    } else {
      response
        .then(resp => c.success(req, res, next, {
          id: resp.id
        }))
        .catch(resp => c.catch(res, resp));
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
  update(req, res, next, modelObject, promise) {
    let c = this;
    if (!modelObject) {
      modelObject = c.Model.query();
      //clear any search
      //modelObject.clear(/.*/).clearSelect();
    }
    req.body.id = parseInt(req.params.ID) || req.params.ID;
    let response = modelObject
      .upsertGraph(req.body);
    if (promise) {
      return response;
    } else {
      response
        .then(resp => c.success(req, res, next, {
          id: resp.id
        }))
        .catch(resp => c.catch(res, resp));
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
  delete(req, res, next, modelObject, promise) {
    let c = this;
    if (!modelObject) {
      modelObject = c.Model.query();
      //clear any search
      //modelObject.clear(/.*/).clearSelect();
    }
    let response = modelObject
      .deleteById(req.params.ID);
    if (promise) {
      return response;
    } else {
      response
        .then(resp => c.success(req, res, next, resp))
        .catch(resp => c.catch(res, resp));
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
  success(req, res, next, resp, status = 200) {
    let response = {
      status,
      success: true,
    };
    if (typeof resp === 'object' && !Array.isArray(resp)) {
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
  catch(res, resp, status = 500) {
    console.log('Error: ', resp);
    let response = {
      status: resp.statusCode || status,
      error: true,
      errorDescription: resp
    }
    delete resp.statusCode;
    delete resp.sql;
    res.status(response.status).json(response);
  }

  /**
   * Abstract method for be override
   * @abstract
   * @param {Object} data - The request data, process before send to data base
   */
  processData(data) {
    throw 'abstract method, override';
  }

}

module.exports = ApiController;
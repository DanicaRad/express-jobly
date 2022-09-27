"use strict";

const { query } = require("express");
const db = require("../db");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for companies. */

class Company {
  /** Create a company (from data), update db, return new company data.
   *
   * data should be { handle, name, description, numEmployees, logoUrl }
   *
   * Returns { handle, name, description, numEmployees, logoUrl }
   *
   * Throws BadRequestError if company already in database.
   * */

  static async create({ handle, name, description, numEmployees, logoUrl }) {
    const duplicateCheck = await db.query(
          `SELECT handle
           FROM companies
           WHERE handle = $1`,
        [handle]);

    if (duplicateCheck.rows[0])
      throw new BadRequestError(`Duplicate company: ${handle}`);

    const result = await db.query(
          `INSERT INTO companies
           (handle, name, description, num_employees, logo_url)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING handle, name, description, num_employees AS "numEmployees", logo_url AS "logoUrl"`,
        [
          handle,
          name,
          description,
          numEmployees,
          logoUrl,
        ],
    );
    const company = result.rows[0];

    return company;
  }

  /** Find all companies with optional filters.
   * 
   * Data can include { name, minEmployees, maxEmployees } 
   * 
   * Returns [{ handle, name, description, numEmployees, logoUrl }, ...]
   */

  static async findAll(data) {
    const baseQuery = `SELECT handle,
                        name,
                        description,
                        num_employees AS "numEmployees",
                        logo_url AS "logoUrl"
                      FROM companies `;  
    // If no filters, return all companies      
    if(!data) {
      const results = await db.query(baseQuery + 'ORDER BY name');
      return results.rows;
    }
    // {name: "name", minEmployees: "10", maxEmployees: "pdfojs"} =>
    //    values = [`%name%`, 10]
    //    queryStringArr = [`name ILIKE $1 `, `num_employees >= $2 `]
    const values = [];
    const queryStringArr = [];
    if(data.name) {
      // case insensitive, matching companies with name = or containing data.name
      values.push(`%${data.name}%`);
      queryStringArr.push(`name ILIKE $${values.length} `);
    }
    if(data.minEmployees && Number.isInteger(+data.minEmployees)) {
      values.push(+data.minEmployees);
      queryStringArr.push(`num_employees >= $${values.length} `)
    }
    if(data.maxEmployees && Number.isInteger(+data.maxEmployees)) {
      values.push(+data.maxEmployees);
      queryStringArr.push(`num_employees <= $${values.length} `);
    }
    // if no valid filters found, return all jobs, otherwise format paramaterized query string with filters

    const queryString = values.length > 0 ? "WHERE " + queryStringArr.join("AND ") + " ORDER BY name" : " ORDER BY name"    
    
    const results = await db.query(baseQuery + queryString, [...values]);

    // Throw error if no results matching filters
    if (results.rows.length === 0) {
      throw new NotFoundError(`No companies found matching ${data}`)
    }
    return results.rows;
  }

  /** Given a company handle, return data about company.
   *
   * Returns { handle, name, description, numEmployees, logoUrl, jobs }
   *   where jobs is [{ id, title, salary, equity, companyHandle }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(handle) {
    const companyRes = await db.query(
          `SELECT c.handle,
                  c.name,
                  c.description,
                  c.num_employees AS "numEmployees",
                  c.logo_url AS "logoUrl",
                  j.id,
                  j.title,
                  j.salary,
                  j.equity
            FROM companies AS c
            LEFT JOIN jobs AS j ON c.handle = j.company_handle
           WHERE handle = $1`,
        [handle]);
    if ( companyRes.rows.length === 0 ) throw new NotFoundError(`No company: ${handle}`);

    const { name, description, numEmployees, logoUrl } = companyRes.rows[0];
    if(companyRes.rows.length === 1 && !companyRes.rows[0].id) {
      return { handle, name, description, numEmployees, logoUrl };
    }

    return {
      handle,
      name,
      description,
      numEmployees,
      logoUrl,
      jobs: companyRes.rows.map(j => {
        return {
          id: j.id,
          title: j.title,
          salary: j.salary,
          equity: j.equity
        }
      })
    }
  }

  /** Update company data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {name, description, numEmployees, logoUrl}
   *
   * Returns {handle, name, description, numEmployees, logoUrl}
   *
   * Throws NotFoundError if not found.
   */

  static async update(handle, data) {
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          numEmployees: "num_employees",
          logoUrl: "logo_url",
        });
    const handleVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE companies 
                      SET ${setCols} 
                      WHERE handle = ${handleVarIdx} 
                      RETURNING handle, 
                                name, 
                                description, 
                                num_employees AS "numEmployees", 
                                logo_url AS "logoUrl"`;
    const result = await db.query(querySql, [...values, handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);

    return company;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(handle) {
    const result = await db.query(
          `DELETE
           FROM companies
           WHERE handle = $1
           RETURNING handle`,
        [handle]);
    const company = result.rows[0];

    if (!company) throw new NotFoundError(`No company: ${handle}`);
  }
}


module.exports = Company;

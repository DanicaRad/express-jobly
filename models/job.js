"use strict";

const { query } = require("express");
const db = require("../db");
const { Company } = require("./company");
const { BadRequestError, NotFoundError } = require("../expressError");
const { sqlForPartialUpdate } = require("../helpers/sql");

/** Related functions for jobs. */

class Job {
  /** Create a job (from data), update db, return new job data.
   *
   * data should be { title, salary, equity, companyHandle }
   *
   * Returns { id, title, salary, equity, companyHandle }
   *
   * Throws BadRequestError if company does not exists or job already in database.
   * */

  static async create({ title, salary, equity, companyHandle }) {
    const checkCompanyExists = await db.query(
          `SELECT handle
           FROM companies
           WHERE handle = $1`,
        [companyHandle]);

    if (!checkCompanyExists.rows[0])
      throw new BadRequestError(`No such company: ${companyHandle}`);

    const checkForDupe = await db.query(
        `SELECT * FROM jobs
         WHERE title = $1
         AND salary = $2
         AND equity = $3
         AND company_handle = $4`,
         [title, salary, equity, companyHandle]
    );
    if(checkForDupe.rows.length > 0) throw new BadRequestError(`Duplicate job : ${title, salary, equity, companyHandle}`)

    const result = await db.query(
          `INSERT INTO jobs
           (title, salary, equity, company_handle)
           VALUES ($1, $2, $3, $4 )
           RETURNING id, title, salary, equity, company_handle AS "companyHandle"`,
        [
          title,
          salary,
          equity,
          companyHandle
        ],
    );
    const job = result.rows[0];

    return job;
  }

  /** Find all jobs with optional filters.
   * 
   * Takes none or all filters { name, minEmployees, maxEmployees } 
   * 
   * Returns [{ handle, name, description, numEmployees, logoUrl }, ...]
   */

  static async findAll(data) {

    const baseQuery = `SELECT id,
                        title,
                        salary,
                        equity,
                        company_handle AS "companyHandle"
                      FROM jobs `;  
    // If no filters in req.query, return all jobs 
    if(!data) {
        const results = await db.query(baseQuery + 'ORDER BY title');
        return results.rows;
    }

    // {title: 'manager', minSalary: '70000'} => 
        // [`title ILIKE $1 `, `salary >= $2 `], [ `%manager%`, 70000 ]
    const queryStringArr = [];
    const validValues =  [];
    if(data.title) {
        validValues.push(`%${data.title}%`);
        queryStringArr.push(`title ILIKE $${validValues.length} `);
    }
    if(data.minSalary && Number.isInteger(+data.minSalary)) {
        validValues.push(+data.minSalary);
        queryStringArr.push(`salary >= $${validValues.length} `);
    }
    if(data.hasEquity === 'true') {
        validValues.push(0);
        queryStringArr.push(`equity >= $${validValues.length} `);
    }

    // if no valid filters found, return all jobs, else format paramaterized query string with filters
    const queryString = validValues.length > 0 ? "WHERE " + queryStringArr.join("AND ") + " ORDER BY title" : " ORDER BY title"    
    
    const results = await db.query(baseQuery + queryString, [...validValues]);

    // Throw error if no results matching filters
    if (results.rows.length === 0) {
    throw new NotFoundError(`No jobs found matching ${data}`)
    }
    return results.rows;
  }

  /** Given a job id, return job matching id.
   *
   * Returns { id, title, salary, equity, companyHandle, jobs }
   *   where jobs is [{ id, title, salary, equity, companyHandle }, ...]
   *
   * Throws NotFoundError if not found.
   **/

  static async get(id) {
    const jobRes = await db.query(
        `SELECT id,
            title,
            salary,
            equity,
            company_handle AS "companyHandle"
        FROM jobs
        WHERE id = $1`,
        [id]);

    const job = jobRes.rows[0];
    if(!job) throw new NotFoundError(`No job with id of ${id} found.`);
    return job;
  }

  /** Update job data with `data`.
   *
   * This is a "partial update" --- it's fine if data doesn't contain all the
   * fields; this only changes provided ones.
   *
   * Data can include: {title, salary, equity }
   * 
   * Job id and companyHandle cannot be changed.
   *
   * Returns {id, title, salary, equity, companyHandle}
   *
   * Throws NotFoundError if not found.
   */

  static async update(id, data) {
    const { setCols, values } = sqlForPartialUpdate(
        data,
        {
          numEmployees: "num_employees",
          logoUrl: "logo_url",
        });
    const idVarIdx = "$" + (values.length + 1);

    const querySql = `UPDATE jobs 
                      SET ${setCols} 
                      WHERE id = ${idVarIdx} 
                      RETURNING id,
                                title, 
                                salary, 
                                equity, 
                                company_handle AS "companyHandle"`;
    const result = await db.query(querySql, [...values, id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job with ID '${id}'`);

    return job;
  }

  /** Delete given company from database; returns undefined.
   *
   * Throws NotFoundError if company not found.
   **/

  static async remove(id) {
    const result = await db.query(
          `DELETE
           FROM jobs
           WHERE id = $1
           RETURNING id`,
        [id]);
    const job = result.rows[0];

    if (!job) throw new NotFoundError(`No job: ${id}`);
  }
}


module.exports = Job;

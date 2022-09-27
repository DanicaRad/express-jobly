"use strict";

const db = require("../db.js");
const { BadRequestError, NotFoundError } = require("../expressError");
const Job = require("./job.js");
const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** create */

describe("create", function () {
    const newJob = {
        title: 'New',
        salary: 100000,
        equity: "0.001",
        companyHandle: 'c1'
    };
    test("works", async function() {
        let job = await Job.create(newJob);
        expect(job).toMatchObject(newJob);

        const result = await db.query(`
            SELECT title, salary, equity, company_handle AS "companyHandle"
                FROM jobs
                WHERE title = 'New'
                LIMIT 1`);
        expect(result.rows).toEqual([
            {
            title: 'New',
            salary: 100000,
            equity: "0.001",
            companyHandle: 'c1'
            }
        ])
    });
    test("bad request with dupe", async function() {
        try {
            await Job.create(newJob);
            await Job.create(newJob);
            fail();
        } catch(err) {
            expect(err instanceof BadRequestError).toBeTruthy();
        }
    });
});

/************************************** findAll */

describe("findAll", function () {
    test("works: no filters", async function() {
        const jobs = await Job.findAll();
        expect(jobs).toEqual([
            {
                id: expect.any(Number),
                title: 'job1',
                salary: 1,
                equity: '0.001',
                companyHandle: 'c1'
            }, 
            {
                id: expect.any(Number),
                title: 'job2',
                salary: 2,
                equity: '0.002',
                companyHandle: 'c2'
            }
        ]);
    });

    test("works: valid filters", async function() {
        const job = await Job.findAll({title: 'job1'});
        expect(job).toEqual([
            {
                id: expect.any(Number),
                title: 'job1',
                salary: 1,
                equity: '0.001',
                companyHandle: 'c1'
            }
        ]);
    });

    test("works: invalid filtering values return all jobs", async function() {
        const jobs = await Job.findAll({ minSalary: 'nope' });
        expect(jobs).toEqual([
            {
                id: expect.any(Number),
                title: 'job1',
                salary: 1,
                equity: '0.001',
                companyHandle: 'c1'
            }, 
            {
                id: expect.any(Number),
                title: 'job2',
                salary: 2,
                equity: '0.002',
                companyHandle: 'c2'
            }
        ]);
    });

    test("works: partial match with filter", async function() {
        const jobs = await Job.findAll({title: "job"});
        expect(jobs).toEqual([
            {
                id: expect.any(Number),
                title: 'job1',
                salary: 1,
                equity: '0.001',
                companyHandle: 'c1'
            }, 
            {
                id: expect.any(Number),
                title: 'job2',
                salary: 2,
                equity: '0.002',
                companyHandle: 'c2'
            }
        ])
    });

    test("works: no matches with filters", async function() {
        try {
            await Job.findAll({ title: "nope"});
            fail();
        } catch(err) {
            expect(err instanceof NotFoundError).toBeTruthy();
        }
    });
});

/************************************** get */

describe("get", function () {

    let dbJob;

    beforeEach( async function() {
        const jobFromDb = await db.query(`
        SELECT id, title, salary, equity, company_handle AS "companyHandle"
            FROM jobs
            WHERE title = 'job1'`);
    dbJob = jobFromDb.rows[0];
    });

    test("works", async function () {
        const job = await Job.get(dbJob.id);
        expect(job).toEqual(dbJob);
    });

    test("works: no matches", async function () {
        try {
            await Job.get(0);
            fail();
        } catch(err) {
            expect(err instanceof NotFoundError).toBeTruthy();
        }
    });
});

/************************************** update */

describe("update", function () {

    let dbJob;

    const updateData = {
        title: "new",
        salary: 10,
        equity: "0.01"
    }

    beforeEach( async function() {
        const jobFromDb = await db.query(`
        SELECT id, title, salary, equity, company_handle AS "companyHandle"
            FROM jobs
            WHERE title = 'job1'`);
    dbJob = jobFromDb.rows[0];
    });

    test("works", async function() {
        const job = await Job.update(dbJob.id, updateData);
        expect(job).toEqual({
            id: dbJob.id,
            companyHandle: dbJob.companyHandle,
            ...updateData,
        });
        const result = await db.query(
            `SELECT id, title, salary, equity, company_handle AS "companyHandle"
            FROM jobs 
            WHERE id = ${dbJob.id}`);
        expect(result.rows).toEqual([{
            id: dbJob.id,
            title: "new",
            salary: 10,
            equity: "0.01",
            companyHandle: dbJob.companyHandle
        }]);
    });

    test("works: null fields", async function() {
        const updateDataSetNulls = {
            title: "new",
            salary: null,
            equity: null
        };
        const job = await Job.update(dbJob.id, updateDataSetNulls);
        expect(job).toEqual({
            id: dbJob.id,
            companyHandle: dbJob.companyHandle,
            ...updateDataSetNulls,
        });
        const result = await db.query(
            `SELECT id, title, salary, equity, company_handle AS "companyHandle"
            FROM jobs 
            WHERE id = ${dbJob.id}`);
        expect(result.rows).toEqual([{
            id: dbJob.id,
            title: "new",
            salary: null,
            equity: null,
            companyHandle: dbJob.companyHandle
        }])
    });

    test("not found if no such job", async function() {
        try {
            await Job.update(0, {title: "nope"});
            fail();
        }  catch(err) {
            expect(err instanceof NotFoundError).toBeTruthy();
        }
    });

    test("bad request with no data", async function() {
        try {
            await Job.update(dbJob.id, {});
            fail();
        } catch(err) {
            expect(err instanceof BadRequestError).toBeTruthy();
        }
    });
});

/************************************** remove */

describe("remove", function () {

    let dbJob;

    beforeEach( async function() {
        const jobFromDb = await db.query(`
        SELECT id, title, salary, equity, company_handle AS "companyHandle"
            FROM jobs
            WHERE title = 'job1'`);
    dbJob = jobFromDb.rows[0];
    });

    test("works", async function () {
      await Job.remove(dbJob.id);
      const res = await db.query(
          `SELECT id FROM jobs WHERE id= $1`, [dbJob.id]);
      expect(res.rows.length).toEqual(0);
    });
  
    test("not found if no such company", async function () {
      try {
        await Job.remove(0);
        fail();
      } catch (err) {
        expect(err instanceof NotFoundError).toBeTruthy();
      }
    });
  });
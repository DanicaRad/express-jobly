"use strict";

const request = require("supertest");

const db = require("../db");
const app = require("../app");

const {
  commonBeforeAll,
  commonBeforeEach,
  commonAfterEach,
  commonAfterAll,
  u1Token,
  u2Token,
} = require("./_testCommon");

beforeAll(commonBeforeAll);
beforeEach(commonBeforeEach);
afterEach(commonAfterEach);
afterAll(commonAfterAll);

/************************************** POST /jobs */

describe("POST /jobs", function () {
  const newJob = {
    title: "newJob",
    salary: 100,
    equity: 0,
    companyHandle: "c1"
  };

  test("works for admins", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send(newJob)
        .set("authorization", `Bearer ${u1Token}`);
    newJob.equity = "0";
    expect(resp.statusCode).toEqual(201);
    expect(resp.body.job).toMatchObject(newJob);
  });

  test("unauth for non-admin", async function() {
    const resp = await request(app)
        .post("/jobs")
        .send(newJob)
        .set("authorization", `Bearer ${u2Token}`);
    expect(resp.statusCode).toEqual(401);
  });

  test("bad request with missing data", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send({
          title: "new",
          salary: 10,
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request with invalid data", async function () {
    const resp = await request(app)
        .post("/jobs")
        .send({
          title: "new",
          salary: "not-a-number",
          equity: 0.001,
          companyHandle: "c1"
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(400);
  });
});

/************************************** GET /jobs */

describe("GET /jobs", function () {
  test("ok for anon", async function () {
    const resp = await request(app).get("/jobs");
    expect(resp.body).toEqual({
        jobs: [
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
    ]});
  });

  test("works: with filters", async function() {
    const resp = await request(app).get(`/jobs?title=job1&minSalary=1`);
    expect(resp.body).toEqual({
        jobs: [
        {
            id: expect.any(Number),
            title: 'job1',
            salary: 1,
            equity: '0.001',
            companyHandle: 'c1'
        }]
    });
  });
  test("works: one valid and invalid filter", async function() {
    const resp = await request(app).get(`/jobs?title=job1&salary=1`);
    expect(resp.body).toEqual({
        jobs: [
        {
            id: expect.any(Number),
            title: 'job1',
            salary: 1,
            equity: '0.001',
            companyHandle: 'c1'
        }]
    });
  });
  test("works: partial matches", async function () {
    const resp = await request(app).get("/jobs?title=job");
    expect(resp.body).toEqual({
        jobs: [
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
    ]});
  });
  test("works: returns all jobs if no valid filters", async function () {
    const resp = await request(app).get("/jobs?name=job&minSalary=oknjo");
    expect(resp.body).toEqual({
        jobs: [
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
    ]});
  });

  test("fails: test next() handler", async function () {
    // there's no normal failure event which will cause this route to fail ---
    // thus making it hard to test that the error-handler works with it. This
    // should cause an error, all right :)
    await db.query("DROP TABLE jobs CASCADE");
    const resp = await request(app)
        .get("/jobs")
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(500);
  });
});

// /************************************** GET /companies/:handle */

describe("GET /jobs/:id", function () {

  test("works for anon", async function () {
    const dbJob = await db.query(`SELECT id, title, salary, equity, company_handle AS "companyHandle" FROM jobs LIMIT 1`);
    let job = dbJob.rows[0];
    const resp = await request(app).get(`/jobs/${job.id}`);
    expect(resp.body).toEqual({ job });
  });

  test("not found for no such job", async function () {
    const resp = await request(app).get(`/jobs/0`);
    expect(resp.statusCode).toEqual(404);
  });
});

// /************************************** PATCH /jobs/:id */

describe("PATCH /companies/:handle", function () {
    let job;

    beforeEach( async function () {
        const dbJob = await db.query(`SELECT id, title, salary, equity, company_handle AS "companyHandle" FROM jobs LIMIT 1`);
        job = dbJob.rows[0];
    });

  test("works for users", async function () {
    const resp = await request(app)
        .patch(`/jobs/${job.id}`)
        .send({
          title: "job1-new",
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.body).toEqual({
      job: {
        id: job.id,
        title: "job1-new",
        salary: job.salary,
        equity: job.equity,
        companyHandle: job.companyHandle
      },
    });
  });

  test("unauth for anon", async function () {
    const resp = await request(app)
        .patch(`/jobs/${job.id}`)
        .send({
          title: "job1-new",
        });
    expect(resp.statusCode).toEqual(401);
  });

  test("not found on no such job", async function () {
    const resp = await request(app)
        .patch(`/jobs/0`)
        .send({
          title: "new job",
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(404);
  });

  test("bad request on companyHandle change attempt", async function () {
    const resp = await request(app)
        .patch(`/jobs/${job.id}`)
        .send({
          companyHandle: "c1-new",
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(400);
  });

  test("bad request on invalid data", async function () {
    const resp = await request(app)
        .patch(`/jobs/${job.id}`)
        .send({
          salary: "not-a-number",
        })
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(400);
  });
});

// /************************************** DELETE /jobs/:id */

describe("DELETE /jobs/:id", function () {
    let job;

    beforeEach( async function () {
        const dbJob = await db.query(`SELECT id, title, salary, equity, company_handle AS "companyHandle" FROM jobs LIMIT 1`);
        job = dbJob.rows[0];
    });

  test("works for users", async function () {
    const resp = await request(app)
        .delete(`/jobs/${job.id}`)
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.body).toEqual({ deleted: `${job.id}` });
  });

  test("unauth for anon", async function () {
    const resp = await request(app)
        .delete(`/jobs/${job.id}`);
    expect(resp.statusCode).toEqual(401);
  });

  test("not found for no such job", async function () {
    const resp = await request(app)
        .delete(`/jobs/0`)
        .set("authorization", `Bearer ${u1Token}`);
    expect(resp.statusCode).toEqual(404);
  });
});

const { sqlForPartialUpdate } = require("./sql");
const { BadRequestError } = require("../expressError");


describe("sqlForPartialUpdate", function() {
    test("works: partial update", function() {
        const sql = sqlForPartialUpdate(
            {
              "firstName": "Bob",
              "email": "new@email.com"
            },
            {
              "firstName": "first_name",
              "lastName": "last_name",
              "isAdmin": "is_admin"
            }
        );
        expect(sql.setCols).toEqual('"first_name"=$1, "email"=$2');
        expect(sql.values).toEqual(["Bob", "new@email.com"]);
    });

    test("works: req schema doesn't match jsToSql", function() {
        const sql = sqlForPartialUpdate(
            {
              "noKey": "value"
            },
            {
              "firstName": "first_name",
              "lastName": "last_name",
              "isAdmin": "is_admin"
            }
        );
        expect(sql.setCols).toEqual('"noKey"=$1');
        expect(sql.values).toEqual(['value']);
    });

    test("duplicate keys: returns first alphabetical val", function() {
        const sql = sqlForPartialUpdate(
            {
              "firstName": "Sam",
              "firstName": "Bob"
            },
            {
              "firstName": "first_name",
              "lastName": "last_name",
              "isAdmin": "is_admin"
            }
        );
        expect(sql.setCols).toEqual('"first_name"=$1');
        expect(sql.values).toEqual(['Bob']);
    });

    test("null value", function() {
        const sql = sqlForPartialUpdate(
            {"firstName": null},
            {"firstName": "first_name"}
        );
        expect(sql.setCols).toEqual('"first_name"=$1');
        expect(sql.values).toEqual([null]);
    });

    test("error: no data", function() {
        expect(() => {
            sqlForPartialUpdate(
            {}, 
            {
                "numEmployees": "num_employees",
                "logoUrl": "logo_url"
            }
        )}).toThrow(BadRequestError);
    });
});
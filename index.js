const express = require('express')
const app = express()
const port = 3000

const comments_api = "https://api.pullpush.io/reddit/search/comment/?";
const posts_api = "https://api.pullpush.io/reddit/search/submission/?"

const SEARCH_PARAMS = {
    TEXT: "q",
    SIZE: "size", //<= 100 (default)
    SORT: "sort", //desc (default) or asc
    SORT_TYPE: "sort_type", //Sort by a specific attribute	"score", "num_comments", "created_utc" (default)
    USER: "author",
    AFTER: "after", // timestamp * 0.001 (same as in response.created_utc)
    BEFORE: "before", // timestamp * 0.001 (same as in response.created_utc)
}

function urlParams(url, params) {
    const search_params = new URLSearchParams(params);
    return url + search_params.toString()
}

app.get('/first/:user', async (req, res) => {
    const api_url = urlParams(comments_api, {
        [SEARCH_PARAMS.SORT]: "asc",
        [SEARCH_PARAMS.SIZE]: 1,
        [SEARCH_PARAMS.USER]: req.params.user
    })
    try {
        const j = await (await fetch(api_url)).json()
        if (j && j.error) {
            return res.status(500).send(`${j.error}`);
        }
        res.send(j);
    } catch (error) {
        res.status(500).send(`${error}`);
    }
})

app.get('/latest/:user', async (req, res) => {
    const api_url = urlParams(comments_api, {
        [SEARCH_PARAMS.SORT]: "desc",
        [SEARCH_PARAMS.SIZE]: 50,
        [SEARCH_PARAMS.USER]: req.params.user
    })
    try {
        const j = await (await fetch(api_url)).json()
        j.data = j.data.map(e => Object.fromEntries(Object.entries(e).filter(([k, v]) => !!v)))
        if (j && j.error) {
            return res.status(500).send(`${j.error}`);
        }
        res.send(j);
    } catch (error) {
        res.status(500).send(`${error}`);
    }
})

async function greedyComments(req, res, username, timeoutsec, body_only = false, before_sec = null) {
    if (!username) {
        return res.status(500).send("No user ID!!!");
    }
    try {
        let latest_comment = parseInt(before_sec) || Math.round((Date.now() + 1) / 1000);

        let data = [];

        let body = `<h1> username: "${username}", from: ${latest_comment} or ${new Date(latest_comment * 1000).toISOString()}</h1>` +
            "<b> pullpush.io quick user archive by https://github.com/yonixw/pullpush-io-all-user-messages</b> <hr/>";
        let body_count = 0;

        const start = Date.now();
        const timeout_sec_int = parseInt(timeoutsec || "25") || 25;
        while (Date.now() - start <= timeout_sec_int * 1000 && !req.closed) {
            const api_url = urlParams(comments_api, {
                [SEARCH_PARAMS.SIZE]: Math.floor(Math.random() * 10 + 50),
                [SEARCH_PARAMS.USER]: username,
                [SEARCH_PARAMS.BEFORE]: latest_comment
            })

            const j = await (await fetch(api_url)).json()
            if (!j || !j.data || j.data.length == 0) {
                if (j.error) {
                    if (body_only) {
                        body += `<mark>Backend Error:</mark> <br/><pre>${j.error}\n</pre></br>`;
                    } else
                        data.push({ error: `${j.error}` });
                } else {
                    console.log({ j, reason: "Breaking because no more data?" });
                }
                break;
            }


            const max_date = Date.now() + 1;
            latest_comment = j.data.reduce((a, b) => Math.min(a, b.created_utc || max_date), max_date)
            if (!latest_comment || latest_comment == max_date) {
                console.log({ username, latest_comment, dates: j?.data?.map(e => e.created_utc), len: j?.data?.length, reason: "Breaking because no least date?" });
                break;
            }

            console.log({ username, latest_comment })

            if (body_only) {
                j.data.forEach(e => {
                    const link = e.parent_id ? parent_id.replace("t3_", "") : (e.permalink ? "https://www.reddit.com/" + e.permalink : "")
                    body += `<mark>(${new Date(e.created_utc * 1000).toISOString()}) <b>r/${e.subreddit}</b> ${e.score ? `(${e.score} points)` : ""} :</mark><br/>` +
                        `<pre>${e.body}\n</pre></br>`;
                    body_count++;
                });
            } else {
                data = data.concat(j.data.map(e => Object.fromEntries(Object.entries(e).filter(([k, v]) => !!v))))
            }
        }

        if (body_only) {
            res.send(body + `<mark>Found ${body_count} comments. Continue with date ${latest_comment} or ${new Date(latest_comment * 1000).toISOString()} </mark>`)
        } else {
            res.send({ latest_comment, data: data, username, count: data.length });
        }
    } catch (error) {
        res.status(500).send(`${error}`);
    }
}

app.get('/latest-greedy/:username', async (req, res) => {
    const { username } = req.params;
    const { timeoutsec } = req.query

    await greedyComments(req, res, username, timeoutsec, false);
})

app.get('/before-greedy/:username/:before', async (req, res) => {
    const { username, before } = req.params;
    const { timeoutsec } = req.query

    await greedyComments(req, res, username, timeoutsec, false, before);
})

app.get('/body-latest-greedy/:username', async (req, res) => {
    const { username } = req.params;
    const { timeoutsec } = req.query

    await greedyComments(req, res, username, timeoutsec, true);
})

app.get('/body-before-greedy/:username/:before', async (req, res) => {
    const { username, before } = req.params;
    const { timeoutsec } = req.query

    await greedyComments(req, res, username, timeoutsec, true, before);
})


app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})

module.exports = app;
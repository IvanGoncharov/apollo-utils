// @ts-check
import fetch from "node-fetch";
import { request } from "@octokit/request";

console.log(process.env);
console.log(
  "url is :" +
    `https://circleci.com/api/v2/project/github/trevor-scheer/apollo-utils/${process.env.CIRCLE_BUILD_NUM}/artifacts`,
);

const ghAuthed = request.defaults({
  headers: {
    authorization: `token ${process.env.GITHUB_TOKEN}`,
  },
});

(async () => {
  const response = await fetch(
    `https://circleci.com/api/v2/project/github/trevor-scheer/apollo-utils/${process.env.CIRCLE_BUILD_NUM}/artifacts`,
    {
      headers: {
        Accept: "application/json",
        "Circle-Token": `${process.env.CIRCLE_TOKEN}`,
      },
    },
  );

  const artifactLinks = (await response.json()).items.map((item) => item.url);

  process.env.CI_PULL_REQUEST;

  console.log(artifactLinks);

  const comments = await ghAuthed("POST /graphql", {
    query: `
      query GetPrComments($url: URI!) { 
        resource(url: $url) {
          ... on PullRequest {
            id
            comments(first: 10) {
              nodes {
                id
                body
                author { login }
              }
            }
          }
        }
      }
    `,
    variables: {
      url: process.env.CI_PULL_REQUEST,
    },
  });

  console.log(comments.data);

  const existingCommentId = comments.data.data.resource.comments.nodes.find(
    (comment) =>
      comment.body.includes(
        "The following artifacts were published to CircleCI:",
      ),
  )?.id;

  const prId = comments.data.data.resource.id;

  const body =
    "The following artifacts were published to CircleCI:\n" +
    artifactLinks.map((url) => `- ${url}`).join("\n") +
    "\n" +
    `These can be \`npm install\`ed into your project like so:\n>\`npm i ${artifactLinks[0]}\`\n\n` +
    "This comment will be updated on every successful build.";

  if (existingCommentId) {
    const updateComment = await ghAuthed("POST /graphql", {
      query: `
        mutation UpdateComment($input: UpdateIssueCommentInput!) {
          updateIssueComment(input: $input) {
            clientMutationId
          }
        }
      `,
      variables: {
        input: {
          id: existingCommentId,
          body,
        },
      },
    });
  } else {
    const newComment = await ghAuthed("POST /graphql", {
      query: `
      mutation AddComment($input: AddCommentInput!) {
        addComment(input: $input) {
          clientMutationId
        }
      }
    `,
      variables: {
        input: {
          subjectId: prId,
          body,
        },
      },
    });
  }
})();

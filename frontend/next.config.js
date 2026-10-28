/** @type {import('next').NextConfig} */
// Phase 0 keeps the build strict: type errors and lint errors SHOULD fail the build,
// because this is the foundation other phases are built on. (This reverses the
// prototype's deliberately forgiving setting — see DECISIONS.md D8.)
module.exports = {
  reactStrictMode: true,
};

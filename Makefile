
SRC = $(shell find src -name "*.ts")\
	$(shell find ../utils/lib -name "*.js")\
	$(shell find ../http-errors/lib -name "*.js")

TEST_FIXTURES = $(shell find tests/fixtures -name "*.ts" -not -path "*/dist/*")

# Build library from TypeScript sources
lib/index.js: $(SRC) node_modules
	npm run build
	touch $@

# Install dependencies
node_modules: package.json
	npm install
	touch $@

# Build test worker fixture
tests/fixtures/dist/worker-router-test.js: $(TEST_FIXTURES) lib/index.js tests/fixtures/package.json
	npm run build:test-worker
	touch $@

# Build test durable object fixture
tests/fixtures/dist/durable-object-router-test.js: $(TEST_FIXTURES) lib/index.js tests/fixtures/package.json
	npm run build:test-do
	touch $@

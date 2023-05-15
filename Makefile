.PHONY: help
help: # Display this help
	@awk 'BEGIN{FS=":.*#";printf "Usage:\n  make <target>\n\nTargets:\n"}/^[a-zA-Z_-]+:.*?#/{printf"  %-10s %s\n",$$1,$$2}' $(MAKEFILE_LIST)

.PHONY: abigen
abigen: # Generate go files
	rm -rf artifacts/
	npx hardhat compile
	npx hardhat run scripts/extract-abi.ts
	docker build -f Dockerfile.abigen -t extract-abi .
	rm -rf artifacts/abi/
	rm -rf pkg/
	mkdir pkg/
	CONTAINER=`docker create extract-abi --name extract-abi`; \
	docker cp $$CONTAINER:/primev pkg/primev; \
	docker rm -v $$CONTAINER

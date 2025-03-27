dev:
	npm run dev

deploy:
	npm run build
	git add dist/index.html
	git commit -m "update website"
	git push

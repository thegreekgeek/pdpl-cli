# Troubleshooting

**I don't see new data coming in. What's happening?**

Depending on how you set up your script, there could be a number of things happening:

- The cron job is not running on the machine you expect it to. Run `crontab -e` to view your cron tasks and make sure it's setup properly.
- The script that cron is supposed to run is not working. Try running the script in your crontab to make sure it runs and completes successfully. 
- The environment variables cannot be found or are incorrect. Pay attention to the script output that's run in cron to see if there are any errors to correct.
- Individual API handlers are failing. Check your API logs with `pdpl api:logs API_NAME` and see if there are any errors listed.
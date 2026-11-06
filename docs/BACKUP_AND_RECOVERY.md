# Backup and recovery

ClubPoint stores operational data in MongoDB. Backups must be created outside the application,
encrypted at rest, access-controlled, and tested by restoring to a separate database.

## Backup

Use `mongodump` against the production connection string and write the archive to protected
storage:

```powershell
mongodump --uri="$env:MONGODB_URI" --archive="clubpoint-$(Get-Date -Format yyyyMMdd-HHmmss).archive.gz" --gzip
```

Do not place connection strings, dump archives, or credentials in the repository. Keep multiple
retention points and at least one copy in a separate account or region.

## Recovery

1. Provision a separate MongoDB database.
2. Restore the archive into that database:

```powershell
mongorestore --uri="$env:MONGODB_URI_RECOVERY" --archive="clubpoint-backup.archive.gz" --gzip
```

3. Run `npm run db:check` with the recovery connection string.
4. Verify administrator sign-in, member access isolation, ledger totals, attendance records,
   publication settings, import history, and audit logs.
5. Only after verification, redirect the application to the recovered database.

Recovery must not overwrite the original database until the restored copy has been validated.
Rotate credentials if a backup or connection string may have been exposed.

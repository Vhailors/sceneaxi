#define _GNU_SOURCE
#include <dirent.h>
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>

static int safe_name(const char *name) {
  return name[0] != '\0' && strcmp(name, ".") != 0 &&
         strcmp(name, "..") != 0 && strchr(name, '/') == NULL;
}

static int same_directory(int left, int right) {
  struct stat left_stat;
  struct stat right_stat;
  return fstat(left, &left_stat) == 0 && fstat(right, &right_stat) == 0 &&
         S_ISDIR(left_stat.st_mode) && S_ISDIR(right_stat.st_mode) &&
         left_stat.st_dev == right_stat.st_dev &&
         left_stat.st_ino == right_stat.st_ino;
}

static int same_entry(int parent, const char *name, int descriptor) {
  struct stat entry_stat;
  struct stat descriptor_stat;
  return fstatat(parent, name, &entry_stat, AT_SYMLINK_NOFOLLOW) == 0 &&
         fstat(descriptor, &descriptor_stat) == 0 &&
         S_ISDIR(entry_stat.st_mode) && S_ISDIR(descriptor_stat.st_mode) &&
         entry_stat.st_dev == descriptor_stat.st_dev &&
         entry_stat.st_ino == descriptor_stat.st_ino;
}

static int clear_directory(int descriptor) {
  int scan = dup(descriptor);
  if (scan < 0) return -1;
  DIR *directory = fdopendir(scan);
  if (directory == NULL) {
    close(scan);
    return -1;
  }
  errno = 0;
  struct dirent *entry;
  while ((entry = readdir(directory)) != NULL) {
    if (strcmp(entry->d_name, ".") == 0 || strcmp(entry->d_name, "..") == 0) {
      continue;
    }
    struct stat status;
    if (fstatat(descriptor, entry->d_name, &status, AT_SYMLINK_NOFOLLOW) != 0) {
      closedir(directory);
      return -1;
    }
    if (S_ISDIR(status.st_mode)) {
      int child = openat(
          descriptor,
          entry->d_name,
          O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
      if (child < 0 || clear_directory(child) != 0) {
        if (child >= 0) close(child);
        closedir(directory);
        return -1;
      }
      close(child);
      if (unlinkat(descriptor, entry->d_name, AT_REMOVEDIR) != 0) {
        closedir(directory);
        return -1;
      }
    } else if (unlinkat(descriptor, entry->d_name, 0) != 0) {
      closedir(directory);
      return -1;
    }
    errno = 0;
  }
  int saved_errno = errno;
  if (closedir(directory) != 0) return -1;
  if (saved_errno != 0) {
    errno = saved_errno;
    return -1;
  }
  return 0;
}

int main(int argc, char **argv) {
  if (argc == 2 && strcmp(argv[1], "clean") == 0) {
    return clear_directory(3) == 0 ? 0 : 74;
  }
  if (
      argc != 4 || strcmp(argv[1], "publish") != 0 ||
      !safe_name(argv[2]) || !safe_name(argv[3])) {
    return 64;
  }
  int exports = openat(3, "exports", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  if (exports < 0) return 74;
  int web = openat(exports, "web", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
  close(exports);
  if (web < 0 || !same_directory(web, 4) || !same_entry(web, argv[2], 5)) {
    if (web >= 0) close(web);
    return 74;
  }
  if (renameat2(web, argv[2], web, argv[3], RENAME_NOREPLACE) == 0) {
    int current_exports =
        openat(3, "exports", O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    int current_web = current_exports < 0
        ? -1
        : openat(
              current_exports,
              "web",
              O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (current_exports >= 0) close(current_exports);
    if (current_web >= 0 && same_directory(current_web, web)) {
      close(current_web);
      close(web);
      return 0;
    }
    if (current_web >= 0) close(current_web);
    if (renameat2(web, argv[3], web, argv[2], RENAME_NOREPLACE) != 0) {
      clear_directory(5);
    }
    close(web);
    return 74;
  }
  int saved_errno = errno;
  close(web);
  if (saved_errno == EEXIST || saved_errno == ENOTEMPTY) return 17;
  return 74;
}

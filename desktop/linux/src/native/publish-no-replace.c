#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <stdio.h>

int main(int argc, char **argv) {
  if (argc != 3) return 64;
  if (renameat2(AT_FDCWD, argv[1], AT_FDCWD, argv[2], RENAME_NOREPLACE) == 0) {
    return 0;
  }
  if (errno == EEXIST || errno == ENOTEMPTY) return 17;
  return 74;
}

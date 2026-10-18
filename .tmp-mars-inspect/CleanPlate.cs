using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;
using System.Linq;
using System.Runtime.InteropServices;

public static class CleanPlate {
  public static string Run(string path, string outPath, float yScale) {
    using (Bitmap src = new Bitmap(path)) {
      int width = src.Width;
      int height = src.Height;
      BitmapData data = src.LockBits(new Rectangle(0, 0, width, height), ImageLockMode.ReadWrite, PixelFormat.Format24bppRgb);
      int stride = data.Stride;
      byte[] bytes = new byte[stride * height];
      Marshal.Copy(data.Scan0, bytes, 0, bytes.Length);
      bool[] mask = new bool[width * height];
      int[][] jobs = new int[][] {
        new int[] {20, 8, 300, 64, 100, 22, 36},
        new int[] {20, 8, 300, 64, 70, 40, 36},
        new int[] {400, 95, 630, 168, 450, 112, 38},
        new int[] {400, 95, 630, 168, 520, 122, 38},
        new int[] {260, 190, 390, 250, 320, 208, 40},
        new int[] {430, 175, 610, 255, 490, 205, 40},
        new int[] {600, 300, 760, 365, 650, 318, 34},
        new int[] {600, 300, 760, 365, 680, 330, 34},
        new int[] {735, 95, 970, 170, 780, 115, 36},
        new int[] {735, 95, 970, 170, 760, 140, 36},
        new int[] {20, 400, 330, 482, 110, 425, 42},
        new int[] {20, 400, 330, 482, 170, 450, 42},
        new int[] {570, 400, 980, 482, 700, 425, 40},
        new int[] {570, 400, 980, 482, 800, 445, 40}
      };
      for (int j = 0; j < jobs.Length; j++) {
        int[] job = jobs[j];
        int y0 = Scale(job[1], yScale, height);
        int y1 = Scale(job[3], yScale, height);
        int sy = Scale(job[5], yScale, height);
        Flood(bytes, mask, stride, width, height, job[4], sy, job[0], y0, job[2], y1, job[6]);
      }
      bool[] grown = (bool[])mask.Clone();
      for (int y = 2; y < height - 2; y++) {
        for (int x = 2; x < width - 2; x++) {
          if (!mask[y * width + x]) continue;
          for (int dy = -2; dy <= 2; dy++) {
            for (int dx = -2; dx <= 2; dx++) grown[(y + dy) * width + (x + dx)] = true;
          }
        }
      }
      mask = grown;
      byte[] cur = (byte[])bytes.Clone();
      byte[] nxt = (byte[])bytes.Clone();
      int[] ox = new int[] {1, -1, 0, 0};
      int[] oy = new int[] {0, 0, 1, -1};
      for (int iter = 0; iter < 240; iter++) {
        for (int y = 1; y < height - 1; y++) {
          for (int x = 1; x < width - 1; x++) {
            if (!mask[y * width + x]) continue;
            int rs = 0, gs = 0, bs = 0;
            for (int d = 0; d < 4; d++) {
              int i = (y + oy[d]) * stride + (x + ox[d]) * 3;
              bs += cur[i];
              gs += cur[i + 1];
              rs += cur[i + 2];
            }
            int o = y * stride + x * 3;
            nxt[o] = (byte)(bs / 4);
            nxt[o + 1] = (byte)(gs / 4);
            nxt[o + 2] = (byte)(rs / 4);
          }
        }
        byte[] swap = cur;
        cur = nxt;
        nxt = swap;
      }
      Marshal.Copy(cur, 0, data.Scan0, cur.Length);
      src.UnlockBits(data);
      ImageCodecInfo jpeg = null;
      ImageCodecInfo[] codecs = ImageCodecInfo.GetImageEncoders();
      for (int i = 0; i < codecs.Length; i++) {
        if (codecs[i].MimeType == "image/jpeg") jpeg = codecs[i];
      }
      EncoderParameters ep = new EncoderParameters(1);
      ep.Param[0] = new EncoderParameter(Encoder.Quality, 93L);
      src.Save(outPath, jpeg, ep);
      int count = 0;
      for (int i = 0; i < mask.Length; i++) if (mask[i]) count++;
      return "masked " + count;
    }
  }

  static int Scale(int y, float yScale, int height) {
    int scaled = (int)Math.Round(y * yScale);
    if (scaled < 0) return 0;
    if (scaled >= height) return height - 1;
    return scaled;
  }

  static void Flood(byte[] bytes, bool[] mask, int stride, int width, int height, int sx, int sy, int x0, int y0, int x1, int y1, int tol) {
    if (sx < x0) sx = x0;
    if (sy < y0) sy = y0;
    if (sx > x1) sx = x1;
    if (sy > y1) sy = y1;
    int seed = sy * stride + sx * 3;
    int sb = bytes[seed];
    int sg = bytes[seed + 1];
    int sr = bytes[seed + 2];
    Queue<int> queue = new Queue<int>();
    bool[] seen = new bool[width * height];
    int start = sy * width + sx;
    queue.Enqueue(start);
    seen[start] = true;
    int[] dx = new int[] {1, -1, 0, 0};
    int[] dy = new int[] {0, 0, 1, -1};
    while (queue.Count > 0) {
      int id = queue.Dequeue();
      int x = id % width;
      int y = id / width;
      mask[id] = true;
      for (int d = 0; d < 4; d++) {
        int nx = x + dx[d];
        int ny = y + dy[d];
        if (nx < x0 || ny < y0 || nx > x1 || ny > y1) continue;
        int nid = ny * width + nx;
        if (seen[nid]) continue;
        int i = ny * stride + nx * 3;
        int b = bytes[i];
        int g = bytes[i + 1];
        int r = bytes[i + 2];
        int dist = Math.Abs(r - sr) + Math.Abs(g - sg) + Math.Abs(b - sb);
        bool text = r > 185 && g > 175 && b > 165;
        bool green = g > 140 && g > r + 25 && g > b + 10 && r < 170;
        bool redTerrain = r > g + 50 && r > 100;
        if (redTerrain && !text && !green) continue;
        if (dist <= tol || text || green) {
          seen[nid] = true;
          queue.Enqueue(nid);
        }
      }
    }
  }
}

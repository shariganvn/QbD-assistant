# Rules: Brainstorm → Executable Plan

## Canonical path and archive boundary

- `IMPLEMENTATION_PLAN.md` chỉ là pointer tới một active plan duy nhất.
- Nội dung execution canonical nằm tại `docs/plans/<workstream>/plan.md`.
- Gate executable nằm tại `docs/plans/<workstream>/gates.yaml`; không duplicate gate trong report.
- Report/evidence hiện hành nằm tại `docs/reports/<workstream>/`.
- Không scan hoặc đọc `docs/plans/OUTDATED/` và `docs/reports/OUTDATED/` nếu user không yêu cầu
  điều tra lịch sử rõ ràng. Archive không được dùng để suy ra status hoặc acceptance.

1. Không có bằng chứng thì trạng thái là unverified, không phải PASS.
   Không dùng “đã code”, “happy path chạy”, hoặc “không throw error” làm bằng chứng.
2. Mỗi requirement/risk phải có một testable gate.
   Một gate bắt buộc ghi đủ:

   Field        Nội dung
   ━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Invariant    Điều tuyệt đối phải đúng
   ───────────  ─────────────────────────────────
   Boundary     Module/CLI/API chịu trách nhiệm
   ───────────  ─────────────────────────────────
   Fixture      Dữ liệu tái lập để chứng minh
   ───────────  ─────────────────────────────────
   Command      Lệnh chạy chính xác
   ───────────  ─────────────────────────────────
   Expected     Exit code, output, side effect
   ───────────  ─────────────────────────────────
   Evidence     File/log/hash lưu kết quả
   ───────────  ─────────────────────────────────
   Owner        Phase chịu trách nhiệm
3. Contract phải mang đủ dữ liệu để enforce policy.
4. Mọi dependency bên ngoài phải có discovery gate trước khi thành design assumption.
5. Pin binary/package/version; xác minh args, stdout, stderr, exit code, network behavior. Chưa biết thì là một spike có outcome rõ ràng, không phải implementation step.
6. Security/admission/provenance mặc định fail-closed.
   Thiếu manifest, tool trả kết quả không đọc được, schema không validate, provenance không xác định → không publish output. Bất kỳ ngoại lệ fail-open nào phải được user duyệt,
   timebox, và gắn risk rõ ràng.
7. Không dùng proxy test để chứng minh production behavior.
8. Negative path là requirement ngang hàng với happy path.
   Mỗi trust boundary phải có ít nhất:

   - input bị từ chối;
   - dependency/tool lỗi;
   - metadata thiếu hoặc sai;
   - assertion fail;
   - xác minh output cũ không bị thay thế (hash trước/sau).
9. “Atomic” hoặc “deterministic” phải là assertion, không là comment. Atomic = failure không đổi output cũ. Deterministic = hai lần chạy cùng input cho hash bằng nhau. Cả hai phải có command/fixture riêng.
10. Mỗi phase chỉ DONE khi toàn bộ gate của phase có evidence. Deferred work phải ghi deferred, owner, điều kiện mở lại; không được đồng thời ghi “all gates pass”.
11. Một thay đổi quyết định làm vô hiệu hóa gate phụ thuộc.
12. Review kiểm traceability, không chỉ đọc diff. Reviewer phải đối chiếu từng requirement với fixture, command, raw output và evidence artifact. Checklist viewer còn trống hoặc command không đúng scope = blocking.
13. Không unblock phase downstream bằng manual claim.

  Template tối thiểu cho mọi phase rủi ro cao:

### Gate G-01 — [Tên invariant]

- Requirement:
- Boundary / owner:
- Fixture:
- Command:
- Expected exit/output:
- Negative cases:
- Evidence artifact:
- Blocks:
- Status: unverified | pass | fail | deferred

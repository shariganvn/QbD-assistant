# Research — lựa chọn local LLM & phần cứng Windows Server cho internal track

- Ngày: 2026-07-11
- Trạng thái: **Active research input cho P1.5; chưa phải quyết định mua sắm hoặc model production**
- Context: `plans/reports/brainstorm-260711-1524-hybrid-llm-provider-zdr-guardrails-report.md`
- Phạm vi: local internal-track worker cho extraction, retrieval, structured output và bounded drafting trên approved corpus; không thay cloud frontier model ở public track và không mở model picker cho end-user.
- Phương pháp: đối chiếu model card/tài liệu chính thức còn hiện hành ngày 2026-07-11; tách facts có nguồn khỏi sizing/khuyến nghị suy luận.

## 1. Executive decision

Không chốt một model chỉ từ leaderboard công khai. P1.5 nên benchmark theo hai nấc:

1. **Pilot 24 GB VRAM:** `Qwen3-14B` vs `Gemma 3 12B IT` vs `Gemma 4 12B`.
2. **Escalation 48 GB VRAM nếu tier 12–14B không đạt quality floor:** `Mistral Small 3.1 24B` vs `Gemma 4 31B`; có thể thêm `Gemma 4 26B-A4B` hoặc `Qwen3-30B-A3B` để đo throughput.

Khuyến nghị mua sắm mặc định nếu cần production headroom: **server một GPU enterprise 48 GB, RAM ECC 256 GB, NVMe enterprise 4 TB**. Chỉ mua GPU 96 GB sau khi có nhu cầu concurrency/context hoặc benchmark chứng minh tier 48 GB chưa đủ. Không chọn Mistral Small 4 cho P1.5 vì chi phí hạ tầng vượt xa scope internal worker.

## 2. Ràng buộc từ design đã chốt

Local model chỉ được đánh giá trong đúng vai trò sau:

- xử lý nội dung internal/internal-derived mà cloud provider chưa pass P0.6;
- extraction, retrieval, classification và drafting có giới hạn theo evidence;
- fail-closed khi model lỗi hoặc không đủ bằng chứng;
- mọi output quan trọng phải grounded, có source span/citation và qua human review;
- local deployment không làm thay đổi data-access boundary, egress control hoặc audit requirements trong report hybrid/ZDR.

Vì vậy, tiêu chí quan trọng nhất là faithfulness và khả năng **không điền khi evidence thiếu**, không phải open-ended writing hay điểm reasoning tổng quát.

## 3. Shortlist và phân hạng

| Model | Sức mạnh tương đối | Độ phù hợp | VRAM triển khai suy luận | Vai trò đề xuất | Verdict |
|---|---:|---:|---:|---|---|
| **Gemma 3 12B IT** | Khá | Cao | 16 GB tối thiểu; 24 GB khuyến nghị | Baseline/control ổn định | **Vào pilot** |
| **Qwen3-14B** | Khá–tốt | Rất cao | 16 GB tối thiểu; 24 GB khuyến nghị | Challenger chính cho tiếng Việt, extraction, structured drafting | **Ưu tiên pilot** |
| **Phi-4 14B** | Tốt về logic | Trung bình | 16–24 GB | Control cho English/reasoning | Optional |
| **Gemma 4 12B** | Tốt, thế hệ mới | Rất cao về tiềm năng | 16 GB tối thiểu; 24 GB khuyến nghị | Candidate thay Gemma 3 sau soak test | **Vào pilot, chưa baseline production** |
| **Mistral Small 3.1 24B** | Tốt | Rất cao | 24 GB Q4 sát giới hạn; 48 GB khuyến nghị | Quality escalation, function calling, fine-tuning | **Ưu tiên tier 48 GB** |
| **Qwen3-30B-A3B** | Tốt | Cao | 24 GB sát giới hạn; 48 GB khuyến nghị | Throughput challenger nhờ MoE | Secondary |
| **Gemma 4 26B-A4B** | Tốt–rất tốt | Cao | 24 GB tối thiểu; 48 GB khuyến nghị | MoE single-GPU worker | Secondary |
| **Gemma 4 31B** | Rất tốt trong local tier | Rất cao | 48 GB khuyến nghị; 96 GB khi concurrency/context lớn | Quality-first local worker | **Ưu tiên tier 48 GB** |
| **Mistral Small 4 119B-A6B** | Rất mạnh | Thấp so với chi phí | Tối thiểu 4×H100 hoặc 2×H200 theo vendor | Không phù hợp P1.5 | **Loại khỏi shortlist** |

### 3.1 Vì sao Qwen3-14B là challenger chính

Qwen công bố Qwen3 hỗ trợ 119 ngôn ngữ/phương ngữ, có Vietnamese, hybrid thinking/non-thinking, và tối ưu thêm cho STEM, instruction/format following cùng agent capabilities. Đây là fit tốt trên giấy cho evidence extraction và draft có cấu trúc. Tuy nhiên, chưa có evidence project-specific rằng Qwen thắng trên hồ sơ dược tiếng Việt; kết luận cuối phải dựa vào golden set.

Nguồn chính thức: [Qwen3 — Think Deeper, Act Faster](https://qwenlm.github.io/blog/qwen3/).

### 3.2 Gemma 12B: Gemma 3 hay Gemma 4?

- **Gemma 3 12B IT** là baseline ít rủi ro hơn: 128K context, hơn 140 ngôn ngữ và hệ sinh thái quantization/runtime đã có thời gian trưởng thành. Google định vị cho question answering, summarization và reasoning.
- **Gemma 4 12B** có system role native, configurable thinking, function calling, speculative decoding và 128K context; phù hợp hơn về feature set. Nhưng Gemma 4 mới được công bố sát ngày report, nên còn rủi ro về quantization, chat template, backend compatibility và regression chưa được soak-test trong project.

Kết luận: dùng Gemma 3 làm control; đưa Gemma 4 12B vào benchmark nhưng chưa mặc định production baseline.

Nguồn chính thức: [Gemma 3 model card](https://ai.google.dev/gemma/docs/core/model_card_3), [Gemma 4 model overview](https://ai.google.dev/gemma/docs/core).

### 3.3 Vì sao Mistral Small 3.1 24B đáng nâng cấp

Mistral Small 3.1 có 24B parameters, 128K context, function calling, multimodal input, Apache 2.0 và vendor xác nhận có thể chạy trên một RTX 4090 hoặc máy 32 GB RAM. Với production server, 48 GB VRAM tạo headroom tốt hơn cho KV cache và concurrency so với ép model vào 24 GB.

Nguồn chính thức: [Mistral Small 3.1](https://mistral.ai/news/mistral-small-3-1/).

### 3.4 Vì sao Phi-4 không đứng đầu

Phi-4 là dense model 14B, context 16K, MIT license và mạnh về reasoning/logic trong môi trường hạn chế compute. Model card cũng nêu trọng tâm chủ yếu là English; do đó phù hợp làm control nhưng kém hấp dẫn hơn Qwen/Gemma cho drafting tiếng Việt và tài liệu dài.

Nguồn chính thức: [Microsoft Phi-4 model card](https://huggingface.co/microsoft/phi-4), [Phi-4 technical report](https://www.microsoft.com/en-us/research/publication/phi-4-technical-report/).

## 4. Sizing bộ nhớ: fact và inference

Google công bố memory requirement gần đúng cho Gemma 4 Q4_0:

| Model | Q4_0 weights/runtime estimate của vendor |
|---|---:|
| Gemma 4 12B | 6.7 GB |
| Gemma 4 26B-A4B | 14.4 GB |
| Gemma 4 31B | 17.5 GB |

Nguồn: [Gemma 4 inference memory requirements](https://ai.google.dev/gemma/docs/core).

Các số trên **không phải tổng VRAM production**. KV cache, CUDA workspace, batching, speculative draft model và context dài tiêu thụ thêm bộ nhớ. Vì vậy report dùng sizing vận hành bảo thủ:

- 12–14B Q4: GPU 16 GB có thể chạy, 24 GB hợp pilot hơn;
- 24–31B Q4: 24 GB chỉ hợp single-request/context kiểm soát; 48 GB là production target;
- 96 GB: dành cho precision cao hơn, context/concurrency lớn hoặc nhiều worker cùng GPU.

Đây là **suy luận triển khai cần benchmark**, không phải SLA từ vendor. Không được dùng context-window tối đa 128K/256K làm mặc định; P1.5 phải đo ở context thật của pipeline.

## 5. Cấu hình phần cứng doanh nghiệp

### Tier A — pilot tiết kiệm

| Thành phần | Khuyến nghị |
|---|---|
| GPU | 1× NVIDIA 24 GB |
| CPU | 16–24 physical cores |
| RAM | 128 GB ECC |
| Storage | 2–4 TB enterprise NVMe |
| OS | Windows Server 2022 hoặc 2025, theo support matrix chính xác của GPU |
| Models | Qwen3-14B; Gemma 3/4 12B; Phi-4 |
| Quantization | GGUF Q4_K_M/Q5 nếu còn headroom |
| Expected use | 1–2 request đồng thời; context bị cap |

Tier này đủ để đóng câu hỏi model-quality của P1.5, chưa phải cam kết production SLA.

### Tier B — production khuyến nghị

| Thành phần | Khuyến nghị |
|---|---|
| GPU | 1× NVIDIA enterprise 48 GB, ví dụ L40S hoặc RTX 6000 Ada-class |
| CPU | 24–32 physical cores |
| RAM | 256 GB ECC |
| Storage | 4 TB enterprise NVMe; mirror/RAID theo policy |
| OS | Windows Server version đã được GPU/driver vendor validate |
| Models | Mistral Small 3.1 24B; Gemma 4 26B-A4B/31B; Qwen3-30B-A3B |
| Expected use | Nhiều request hơn pilot, nhưng concurrency phải benchmark ở context thật |

Đây là điểm cân bằng hợp lý nhất giữa quality, một-GPU operation và chi phí cho internal track.

### Tier C — headroom 96 GB

| Thành phần | Khuyến nghị |
|---|---|
| GPU | 1× RTX PRO 6000 Blackwell Server Edition 96 GB hoặc tương đương được chứng nhận |
| CPU | 32+ physical cores |
| RAM | 256–512 GB ECC |
| Storage | 4–8 TB enterprise NVMe |
| OS | Ưu tiên Windows Server 2025 cho RTX PRO 6000 Server Edition theo matrix đã verify |
| Use case | 31B precision cao hơn, context/concurrency lớn, hoặc colocate embeddings/reranker |

NVIDIA công bố RTX PRO 6000 Blackwell Server Edition có 96 GB GDDR7. Driver R595 hỗ trợ Windows Server 2022/2025 nói chung, nhưng bảng validation riêng cho RTX PRO 6000 Server Edition liệt kê Windows Server 2025; procurement phải kiểm exact SKU + driver branch thay vì suy diễn từ support chung.

Nguồn chính thức: [NVIDIA Data Center GPU Driver R595 release notes](https://docs.nvidia.com/datacenter/tesla/pdf/NVIDIA_Data_Center_GPU_Driver_Release_Notes_595_v2.0.pdf), [NVIDIA RTX PRO AI Factory reference architecture](https://docs.nvidia.com/enterprise-reference-architectures/whitepaper/rtx-pro-ai-factory.pdf).

## 6. Runtime đề xuất trên Windows Server

P1.5 nên bắt đầu bằng:

- `llama.cpp` native Windows + CUDA;
- GGUF quantized artifact được pin checksum;
- `llama-server` làm OpenAI-compatible local endpoint;
- pin runtime version, CUDA/driver version, model revision, quantization và chat template;
- chạy dưới Windows Service với auto-restart, health check và resource limits.

`llama.cpp` có Windows binaries, CUDA backend và documented server mode. Đây là đường spike ít phụ thuộc nhất vào Linux. Production decision vẫn phải dựa trên soak test; không mặc định mọi optimization của vLLM/SGLang có parity trên Windows.

Nguồn chính thức: [llama.cpp server documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md), [llama.cpp install documentation](https://github.com/ggml-org/llama.cpp/blob/master/docs/install.md).

### Security/operations bắt buộc

- bind local endpoint vào internal VLAN/loopback phù hợp, không public Internet;
- authentication hoặc mTLS giữa app và model server;
- outbound deny-by-default cho inference host;
- least-privilege service account, không cấp credential tới cloud/internal store ngoài scope;
- mã hóa volume chứa corpus/cache/log;
- audit `model + model revision + quantization + prompt-template version + data classification + consent version`;
- cap context, concurrency, timeout và output tokens;
- không log raw internal prompt/output nếu retention policy chưa cho phép;
- fail-closed khi model server unhealthy hoặc structured output/citation validation fail.

Local deployment không tự động tạo security boundary nếu host còn outbound Internet, endpoint mở hoặc service account có quyền quá rộng.

## 7. Golden-set gate cho P1.5

Không dùng benchmark vendor làm pass/fail. Tạo 100–200 cases đại diện cho workflow thực:

| Tiêu chí | Trọng số đề xuất |
|---|---:|
| Factual faithfulness / không bịa | 30% |
| Extraction accuracy | 20% |
| Citation/source-span correctness | 15% |
| Bounded drafting quality | 15% |
| Structured-output compliance | 10% |
| Latency/throughput | 5% |
| Operational stability | 5% |

Dataset phải có:

- extraction từ prose, bảng và tài liệu dài;
- số liệu, đơn vị, khoảng giá trị và missing evidence;
- English regulatory + tiếng Việt chuyên ngành;
- JSON schema/function-call compliance;
- retrieved document chứa prompt injection;
- case buộc model abstain hoặc để trống;
- deterministic replay trên cùng model/runtime revision.

Điều kiện loại ngay:

- bịa số liệu, citation hoặc nguồn;
- điền khi evidence thiếu;
- không tuân thủ schema sau retry policy đã định;
- làm theo instruction độc hại nằm trong retrieved evidence;
- gửi internal-derived content ra provider chưa pass P0.6;
- vượt latency/error-rate floor do PO phê duyệt.

## 8. Procurement sequence

1. Dùng hoặc thuê tạm GPU 24 GB để chạy pilot ba model chính.
2. Chốt golden set, quality floor, context distribution và concurrency target trước khi chọn SKU.
3. Nếu tier 12–14B đạt floor: giữ 24 GB cho pilot; chỉ nâng GPU theo SLA/concurrency.
4. Nếu không đạt: benchmark tier 24–31B trên GPU 48 GB.
5. Chỉ đánh giá 96 GB sau khi 48 GB thiếu headroom có evidence.
6. Không mua multi-H100/H200 cho P1.5 nếu chưa có benchmark chứng minh nhu cầu.

## 9. Open decisions cần PO/IT đóng

- pass/fail floor cho quality, latency, throughput và error rate;
- peak concurrency và percentile context thực tế;
- Windows Server 2022 hay 2025; exact GPU SKU/driver certification;
- có cho phép quantization Q4 hay yêu cầu Q8/BF16 cho validation;
- retention/logging policy cho prompt, output, KV/cache và crash dump;
- quy trình model artifact approval, checksum, vulnerability/license review và rollback;
- owner vận hành, patch cadence và offline update process.

## 10. Recommended conclusion

- **Không trả lời “Gemma 12B hay model khác?” bằng một tên duy nhất.**
- Pilot ưu tiên `Qwen3-14B`; dùng `Gemma 3 12B IT` làm control và `Gemma 4 12B` làm candidate thế hệ mới.
- Production sweet spot là **một GPU enterprise 48 GB** với `Mistral Small 3.1 24B` hoặc `Gemma 4 31B` nếu tier nhỏ không đạt.
- Gemma 4 12B có thể trở thành lựa chọn tốt nhất về cost/quality, nhưng cần soak test vì quá mới tại thời điểm report.
- Mistral Small 4 bị loại khỏi shortlist hiện tại do hạ tầng tối thiểu quá lớn so với nhiệm vụ.
- Model cuối cùng chỉ được promote sau golden-set gate và egress/security tests; report này không tự đóng P1.5.

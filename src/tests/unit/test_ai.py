
from modules.ai.domain.inference_result import InferenceResult
from modules.ai.domain.model import Model
from modules.ai.domain.prompt import Prompt


def test_model_creation():
    model = Model(name="test-model", provider="test", temperature=0.5, max_tokens=512)
    assert model.name == "test-model"
    assert model.provider == "test"
    assert model.temperature == 0.5
    assert model.max_tokens == 512


def test_prompt_rendering():
    prompt = Prompt(
        template="Hello {name}, your score is {score}",
        variables={"name": "Alice", "score": "95"},
    )
    rendered = prompt.render()
    assert rendered == "Hello Alice, your score is 95"


def test_inference_result():
    result = InferenceResult(
        content="Test response",
        model="test-model",
        usage={"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30},
    )
    assert result.content == "Test response"
    assert result.model == "test-model"
    assert result.usage["total_tokens"] == 30


def test_prompt_rendering_is_single_pass():
    prompt = Prompt(
        template="Claim: {claim}\nEvidence: {evidence}",
        variables={"claim": "C {evidence}", "evidence": "E {claim}"},
    )
    assert prompt.render() == "Claim: C {evidence}\nEvidence: E {claim}"


def test_prompt_leaves_unknown_placeholders():
    prompt = Prompt(template='JSON: {"verdict": "x"} {name}', variables={"name": "A"})
    assert prompt.render() == 'JSON: {"verdict": "x"} A'
